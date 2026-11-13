import {
  archiveLayer,
  frameLayer,
  rollLayer,
} from '../../../domain/details/layers.ts';
import { resolveDetails } from '../../../domain/details/resolve-details.ts';
import { cameraLabel } from '../../../domain/equipment/camera.ts';
import { filmStockLabel } from '../../../domain/equipment/film-stock.ts';
import { lensLabel } from '../../../domain/equipment/lens.ts';
import type { Frame, Roll, Version } from '../../../domain/rolls/roll.ts';
import type { ArchiveContext } from '../../../domain/shared/archive-context.ts';
import type { FrameId, RollId } from '../../../domain/shared/ids.ts';
import { err, ok, type Result } from '../../../domain/shared/result.ts';
import { sha256Hex } from '../../../domain/shared/sha256-hex.ts';
import type { Slug } from '../../../domain/shared/slug.ts';
import {
  planSiteBuild,
  type SiteStatus,
} from '../../../domain/sites/plan-site-build.ts';
import { framePageName } from '../../../domain/sites/frame-page-name.ts';
import { renderSite } from '../../../domain/sites/render-site.ts';
import {
  siteImageInputsText,
  siteImagePath,
} from '../../../domain/sites/site-image-name.ts';
import { siteDesign } from '../../../domain/sites/site-design.ts';
import { siteImageSizes } from '../../../domain/sites/site-image-sizes.ts';
import type { SiteManifest } from '../../../domain/sites/site-manifest.ts';
import type { SiteOptions } from '../../../domain/sites/site-options.ts';
import type { SiteImage, SitePhoto } from '../../../domain/sites/site-photo.ts';
import { shotLabel } from '../../../domain/sites/shot-label.ts';
import {
  eventGroupLabel,
  rollGroupLabel,
} from '../../../domain/sites/group-labels.ts';
import type { BlobStore } from '../../ports/blob-store.ts';
import type { EquipmentRepository } from '../../ports/equipment-repository.ts';
import type { EventRepository } from '../../ports/event-repository.ts';
import type { ImageRenderer } from '../../ports/image-renderer.ts';
import type { RollRepository } from '../../ports/roll-repository.ts';
import type { SettingsRepository } from '../../ports/settings-repository.ts';
import type { SiteFolders } from '../../ports/site-folders.ts';

/** JPEG quality of the images on a site. */
const quality = 82;

export interface BuildSiteInput {
  readonly slug: Slug;
  /** The frames to show, in the order to show them (shot order). */
  readonly frames: readonly {
    readonly rollId: RollId;
    readonly frameId: FrameId;
  }[];
  readonly options: SiteOptions;
  /**
   * Build it afresh (FF-191): make every image and page again, keeping
   * nothing from the built site, even when it's up to date.
   */
  readonly fresh?: boolean;
  /** Stops the build between images, leaving the site as it was. */
  readonly signal?: AbortSignal;
  /** Told after each image is dealt with, to show "Making images: 12 of 40". */
  readonly onProgress?: (done: number, total: number) => void;
}

export interface BuiltSite {
  readonly photos: number;
  /** Frames left out because they're hidden, gone or have no scan. */
  readonly leftOut: number;
  readonly imagesMade: number;
  readonly imagesUnchanged: number;
}

/** Why a site wasn't built. */
export type BuildSiteError =
  /** `Sites/<slug>/` holds something that isn't a built site; nothing was changed. */
  | { readonly kind: 'folder-in-the-way'; readonly slug: Slug }
  | { readonly kind: 'cancelled' };

/** An image to make: where it goes and what it's made from. */
interface ImageJob {
  readonly image: SiteImage;
  readonly roll: Roll;
  readonly version: Version;
  readonly longestEdge: number;
  readonly author: string | undefined;
  readonly copyright: string | undefined;
}

/**
 * Builds a site (D92): a self-contained static site of the frames given, in
 * `Sites/<slug>/`, from the archive as it is. Each frame is shown from the
 * version shown, turned as it's shown, at a few sizes, carrying only its
 * author and copyright. An image is made only when what it's made from has
 * changed; the rest are brought across untouched. The build is made beside
 * the site and swapped in at the end, so a failure or a cancel leaves the
 * site as it was, and a site that's already up to date isn't touched.
 */
export class BuildSite {
  readonly #rolls: RollRepository;
  readonly #settings: SettingsRepository;
  readonly #equipment: EquipmentRepository;
  readonly #events: EventRepository;
  readonly #blobs: BlobStore;
  readonly #renderer: ImageRenderer;
  readonly #folders: SiteFolders;

  constructor(
    rolls: RollRepository,
    settings: SettingsRepository,
    equipment: EquipmentRepository,
    events: EventRepository,
    blobs: BlobStore,
    renderer: ImageRenderer,
    folders: SiteFolders,
  ) {
    this.#rolls = rolls;
    this.#settings = settings;
    this.#equipment = equipment;
    this.#events = events;
    this.#blobs = blobs;
    this.#renderer = renderer;
    this.#folders = folders;
  }

  /**
   * Whether the site as built matches what it would be built from now: not
   * built, up to date, or out of date and why. Nothing is made or written.
   */
  async status(
    ctx: ArchiveContext,
    input: Pick<BuildSiteInput, 'slug' | 'frames' | 'options'>,
  ): Promise<SiteStatus | { readonly state: 'in-the-way' }> {
    const state = await this.#folders.inspect(ctx, input.slug);
    if (state.kind === 'in-the-way') {
      return { state: 'in-the-way' };
    }
    const { photos } = await this.#gather(ctx, input);
    return planSiteBuild(
      state.kind === 'built' ? state.manifest : undefined,
      photos,
      input.options,
    ).status;
  }

  async execute(
    ctx: ArchiveContext,
    input: BuildSiteInput,
  ): Promise<Result<BuiltSite, BuildSiteError>> {
    const state = await this.#folders.inspect(ctx, input.slug);
    if (state.kind === 'in-the-way') {
      return err({ kind: 'folder-in-the-way', slug: input.slug });
    }
    const { photos, jobs, leftOut } = await this.#gather(ctx, input);
    const plan = planSiteBuild(
      state.kind === 'built' ? state.manifest : undefined,
      photos,
      input.options,
    );
    const fresh = input.fresh === true;
    if (plan.status.state === 'up-to-date' && !fresh) {
      return ok({
        photos: photos.length,
        leftOut,
        imagesMade: 0,
        imagesUnchanged: jobs.length,
      });
    }
    const build = await this.#folders.begin(ctx, input.slug);
    let made = 0;
    let unchanged = 0;
    try {
      for (const job of jobs) {
        if (input.signal?.aborted === true) {
          await build.discard();
          return err({ kind: 'cancelled' });
        }
        if (!fresh && (await build.keep(job.image.src))) {
          unchanged += 1;
        } else {
          await build.writeImage(job.image.src, await this.#make(ctx, job));
          made += 1;
        }
        input.onProgress?.(made + unchanged, jobs.length);
      }
      for (const file of renderSite(photos, input.options)) {
        await build.writeFile(file.path, file.content);
      }
      const manifest: SiteManifest = {
        version: 1,
        design: siteDesign,
        options: input.options,
        photos,
      };
      await build.commit(manifest);
    } catch (error) {
      await build.discard();
      throw error;
    }
    return ok({
      photos: photos.length,
      leftOut,
      imagesMade: made,
      imagesUnchanged: unchanged,
    });
  }

  async #make(ctx: ArchiveContext, job: ImageJob): Promise<Uint8Array> {
    return this.#renderer.render(
      await this.#blobs.get(ctx, job.roll.id, job.version.file),
      job.version.rotate,
      {
        longestEdge: job.longestEdge,
        quality,
        metadata: 'author-and-copyright',
      },
      { author: job.author, copyright: job.copyright },
    );
  }

  /** What each frame is on the page, and the images to make for it. */
  async #gather(ctx: ArchiveContext, input: Pick<BuildSiteInput, 'frames'>) {
    const settings = (await this.#settings.get(ctx))?.settings;
    const photos: SitePhoto[] = [];
    const jobs: ImageJob[] = [];
    let leftOut = 0;
    for (const { rollId, frameId } of input.frames) {
      const roll = (await this.#rolls.get(ctx, rollId))?.roll;
      const frame = roll?.frames.find((f) => f.id === frameId);
      const version = frame === undefined ? undefined : shown(frame);
      if (
        roll === undefined ||
        frame === undefined ||
        frame.hidden ||
        version === undefined
      ) {
        leftOut += 1;
        continue;
      }
      const details = resolveDetails([
        ...(settings === undefined ? [] : [archiveLayer(settings)]),
        rollLayer(roll),
        frameLayer(frame),
      ]);
      const author = details.author?.value;
      const copyright = details.copyright?.value;
      const images: SiteImage[] = [];
      const sizes = siteImageSizes(
        version.width,
        version.height,
        version.rotate,
      );
      for (const size of sizes) {
        const madeFrom = await sha256Hex(
          siteImageInputsText({
            sha256: version.sha256,
            rotate: version.rotate,
            longestEdge: size.longestEdge,
            author,
            copyright,
          }),
        );
        const image: SiteImage = {
          src: siteImagePath(frame.id, size.longestEdge, madeFrom),
          width: size.width,
          madeFrom,
        };
        images.push(image);
        jobs.push({
          image,
          roll,
          version,
          longestEdge: size.longestEdge,
          author,
          copyright,
        });
      }
      const widest = sizes.at(-1);
      if (widest === undefined) {
        continue;
      }
      const event =
        details.event === undefined
          ? undefined
          : (await this.#events.get(ctx, details.event.value))?.event;
      const camera =
        details.camera === undefined
          ? undefined
          : await this.#equipment.getCamera(ctx, details.camera.value);
      const lens =
        details.lens === undefined
          ? undefined
          : await this.#equipment.getLens(ctx, details.lens.value);
      const film =
        details.film === undefined
          ? undefined
          : await this.#equipment.getFilmStock(ctx, details.film.value);
      const eventLabel =
        event === undefined ? undefined : eventGroupLabel(event);
      photos.push({
        frame: frame.id,
        // A site never names a roll (D107): the frame's title, else where or
        // when it was taken.
        alt:
          frame.title ??
          (event === undefined
            ? details.shot === undefined
              ? 'Photo'
              : `Photo from ${shotLabel(details.shot.value)}`
            : `Photo from ${event.name}`),
        images,
        width: widest.width,
        height: widest.height,
        file: framePageName(frame.number, frame.id),
        rating: frame.rating,
        roll: rollGroupLabel(roll),
        ...(eventLabel === undefined ? {} : { event: eventLabel }),
        details: {
          ...(frame.title === null ? {} : { title: frame.title }),
          ...(details.shot === undefined
            ? {}
            : { shot: shotLabel(details.shot.value) }),
          ...(camera === undefined ? {} : { camera: cameraLabel(camera) }),
          ...(lens === undefined ? {} : { lens: lensLabel(lens) }),
          ...(film === undefined ? {} : { film: filmStockLabel(film) }),
        },
      });
    }
    return { photos, jobs, leftOut };
  }
}

/** The version shown for a frame: its chosen one, else its first (D15, D46). */
function shown(frame: Frame): Version | undefined {
  return (
    frame.versions.find((v) => v.id === frame.defaultVersion) ??
    frame.versions[0]
  );
}
