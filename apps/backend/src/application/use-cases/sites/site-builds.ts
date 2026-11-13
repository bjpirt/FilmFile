import type { ArchiveContext } from '../../../domain/shared/archive-context.ts';
import type { FrameId, RollId } from '../../../domain/shared/ids.ts';
import type {
  NotFound,
  ValidationFailed,
} from '../../../domain/shared/domain-error.ts';
import { err, ok, type Result } from '../../../domain/shared/result.ts';
import type { Slug } from '../../../domain/shared/slug.ts';
import { describeSiteStatus } from '../../../domain/sites/plan-site-build.ts';
import type { SiteOptions } from '../../../domain/sites/site-options.ts';
import type { Site } from '../../../domain/sites/site.ts';
import type { SiteRepository } from '../../ports/site-repository.ts';
import type { SearchFrames } from '../selections/search-frames.ts';
import type { SettingsRepository } from '../../ports/settings-repository.ts';
import type { Settings } from '../../../domain/settings/settings.ts';
import type { BuildSite } from './build-site.ts';

/** Where a build has got to. */
export interface SiteBuildProgress {
  readonly state: 'running' | 'done' | 'cancelled' | 'failed';
  /** Images dealt with so far, made or brought across. */
  readonly done: number;
  readonly total: number;
  /** Photos on the site, and frames left out (hidden, gone or with no scan). */
  readonly photos: number;
  readonly leftOut: number;
  readonly imagesMade: number;
  readonly imagesUnchanged: number;
}

/** Whether the built site matches the archive now, in words, and the latest build. */
export interface SiteFreshness {
  readonly freshness: 'not-built' | 'up-to-date' | 'out-of-date' | 'in-the-way';
  /** "Not built yet", "Up to date", "Out of date: 3 frames added, 1 removed, 2 changed". */
  readonly message: string;
  readonly build: SiteBuildProgress | undefined;
}

interface Job {
  progress: SiteBuildProgress;
  readonly controller: AbortController;
}

/** What a site is built with: its presentation, titled with its name (FF-179). */
/** What a site is built with: its own title, and its copyright or else the archive's (D108). */
function optionsOf(site: Site, settings: Settings | undefined): SiteOptions {
  return {
    title: site.presentation.title,
    copyright: site.presentation.copyright ?? settings?.copyright ?? '',
    captions: site.presentation.captions,
  };
}

/**
 * Builds sites in the background, so the page can follow progress and cancel,
 * and says whether each built site is up to date (D92). A site is built from
 * the frames its selection finds as the archive is now. One build of a site
 * runs at a time; asking again while it runs follows that one.
 */
export class SiteBuilds {
  readonly #sites: SiteRepository;
  readonly #search: SearchFrames;
  readonly #building: BuildSite;
  readonly #settings: SettingsRepository;
  readonly #jobs = new Map<Slug, Job>();

  constructor(
    sites: SiteRepository,
    search: SearchFrames,
    building: BuildSite,
    settings: SettingsRepository,
  ) {
    this.#sites = sites;
    this.#search = search;
    this.#building = building;
    this.#settings = settings;
  }

  async #optionsOf(ctx: ArchiveContext, site: Site): Promise<SiteOptions> {
    return optionsOf(site, (await this.#settings.get(ctx))?.settings);
  }

  async #framesOf(ctx: ArchiveContext, site: Site) {
    const found = await this.#search.execute(ctx, {
      selection: site.selection,
    });
    return found
      .filter((frame) => !frame.excluded)
      .map(({ rollId, frameId }) => ({ rollId, frameId }));
  }

  /**
   * Starts building the site (afresh, making every image again, when asked:
   * FF-191), or gives the build already running. Refused if `Sites/<slug>`
   * holds something else.
   */
  async start(
    ctx: ArchiveContext,
    input: { readonly slug: Slug; readonly fresh?: boolean },
  ): Promise<Result<SiteBuildProgress, NotFound | ValidationFailed>> {
    const found = await this.#sites.get(ctx, input.slug);
    if (found === undefined) {
      return err({ kind: 'not-found', entity: 'site', id: input.slug });
    }
    const running = this.#jobs.get(input.slug);
    if (running?.progress.state === 'running') {
      return ok(running.progress);
    }
    const { site } = found;
    const frames = await this.#framesOf(ctx, site);
    const options = await this.#optionsOf(ctx, site);
    const status = await this.#building.status(ctx, {
      slug: site.slug,
      frames,
      options,
    });
    if (status.state === 'in-the-way') {
      return err({
        kind: 'validation-failed',
        issues: [
          {
            path: ['site'],
            message: `Sites/${site.slug} holds something else`,
          },
        ],
      });
    }
    const job: Job = {
      progress: {
        state: 'running',
        done: 0,
        total: 0,
        photos: 0,
        leftOut: 0,
        imagesMade: 0,
        imagesUnchanged: 0,
      },
      controller: new AbortController(),
    };
    this.#jobs.set(site.slug, job);
    void this.#run(ctx, site, frames, options, input.fresh === true, job);
    return ok(job.progress);
  }

  async #run(
    ctx: ArchiveContext,
    site: Site,
    frames: readonly { readonly rollId: RollId; readonly frameId: FrameId }[],
    options: SiteOptions,
    fresh: boolean,
    job: Job,
  ): Promise<void> {
    const update = (change: Partial<SiteBuildProgress>) => {
      job.progress = { ...job.progress, ...change };
    };
    try {
      const built = await this.#building.execute(ctx, {
        slug: site.slug,
        frames,
        options,
        fresh,
        signal: job.controller.signal,
        onProgress: (done, total) => {
          update({ done, total });
        },
      });
      if (built.ok) {
        const { photos, leftOut, imagesMade, imagesUnchanged } = built.value;
        const images = imagesMade + imagesUnchanged;
        update({
          state: 'done',
          done: images,
          total: images,
          photos,
          leftOut,
          imagesMade,
          imagesUnchanged,
        });
      } else {
        update({
          state: built.error.kind === 'cancelled' ? 'cancelled' : 'failed',
        });
      }
    } catch {
      // The page is told it failed, in words that give no internals; the site
      // is as it was, since a build is only swapped in whole.
      update({ state: 'failed' });
    }
  }

  /** Whether the site is built and up to date, and how the latest build went. */
  async status(
    ctx: ArchiveContext,
    input: { readonly slug: Slug },
  ): Promise<Result<SiteFreshness, NotFound>> {
    const found = await this.#sites.get(ctx, input.slug);
    if (found === undefined) {
      return err({ kind: 'not-found', entity: 'site', id: input.slug });
    }
    const { site } = found;
    const status = await this.#building.status(ctx, {
      slug: site.slug,
      frames: await this.#framesOf(ctx, site),
      options: await this.#optionsOf(ctx, site),
    });
    const build = this.#jobs.get(site.slug)?.progress;
    if (status.state === 'in-the-way') {
      return ok({
        freshness: 'in-the-way',
        message: `Sites/${site.slug} holds something else`,
        build,
      });
    }
    return ok({
      freshness: status.state,
      message: describeSiteStatus(status),
      build,
    });
  }

  /** Stops the build running for the site, leaving the site as it was. */
  cancel(input: { readonly slug: Slug }): Result<undefined, NotFound> {
    const job = this.#jobs.get(input.slug);
    if (job?.progress.state !== 'running') {
      return err({ kind: 'not-found', entity: 'site', id: input.slug });
    }
    job.controller.abort();
    return ok(undefined);
  }
}
