import type { ArchiveContext } from '../../../domain/shared/archive-context.ts';
import type {
  Busy,
  NotFound,
  PublishFailed,
  PublishFailureReason,
  ValidationFailed,
} from '../../../domain/shared/domain-error.ts';
import { err, ok, type Result } from '../../../domain/shared/result.ts';
import type { Slug } from '../../../domain/shared/slug.ts';
import {
  planSitePublish,
  type BuiltFile,
  type SitePublishPlan,
} from '../../../domain/sites/plan-site-publish.ts';
import { publishFailureMessage } from '../../../domain/sites/publish-failure-message.ts';
import { publishedFileKind } from '../../../domain/sites/published-file.ts';
import type { PublishTarget } from '../../../domain/sites/publish-target.ts';
import type { ErrorReporter } from '../../ports/error-reporter.ts';
import type {
  BucketTarget,
  PublishBucket,
  RemoteFile,
} from '../../ports/publish-bucket.ts';
import type { SettingsRepository } from '../../ports/settings-repository.ts';
import type { SiteFolders } from '../../ports/site-folders.ts';
import type { SiteRepository } from '../../ports/site-repository.ts';
import type { SiteBuilds } from './site-builds.ts';
import type { SiteWork } from './site-work.ts';

/** Where a publish has got to. */
export interface SitePublishProgress {
  readonly state: 'running' | 'done' | 'cancelled' | 'failed';
  /** What it's doing: building the site first, putting files in the bucket, or removing what's gone. */
  readonly phase: 'building' | 'uploading' | 'removing';
  /** Images (building) or files (uploading, removing) dealt with so far. */
  readonly done: number;
  readonly total: number;
  /** Why it failed, if it did; `build-failed` when the site couldn't be built first. */
  readonly failure: PublishFailureReason | 'build-failed' | null;
  /** What to fix, in words, when it failed. */
  readonly message: string | null;
}

/** How the bucket stands against the built site, and how the latest publish since the service started went. */
export interface SitePublished {
  /**
   * `unknown`: the bucket couldn't be asked (see `check`); `not-built`:
   * there's nothing built to compare with; `not-published`: the bucket has
   * no `index.html`; `up-to-date`; or `needs-update`.
   */
  readonly stands:
    'unknown' | 'not-built' | 'not-published' | 'up-to-date' | 'needs-update';
  /** Why the bucket couldn't be asked, in words, when `stands` is `unknown`. */
  readonly check: {
    readonly failure: PublishFailureReason;
    readonly message: string;
  } | null;
  /** When `index.html` in the bucket was written, an ISO 8601 time. */
  readonly publishedAt: string | null;
  /** Files to upload or remove to make the bucket the built site. */
  readonly filesToUpdate: number;
  /** Files in the bucket now, which unpublishing would remove. */
  readonly filesInBucket: number;
  readonly publish: SitePublishProgress | null;
}

interface Job {
  progress: SitePublishProgress;
  readonly controller: AbortController;
}

// How many files go up at once: thousands of small files would otherwise
// each take a round trip of their own.
const uploadsAtOnce = 4;

const neverStopped = new AbortController().signal;

/** Where a site goes: its bucket and address, in the account set in Settings (D119). */
interface Destination extends PublishTarget {
  /** Null until the account is set in Settings. */
  readonly accountId: string | null;
}

const noAccount: PublishFailed = {
  kind: 'publish-failed',
  reason: 'no-account',
  bucket: '',
};

/** The bucket, once the account is known. */
function bucketOf(
  destination: Destination,
): Result<BucketTarget, PublishFailed> {
  return destination.accountId === null
    ? err({ ...noAccount, bucket: destination.bucket })
    : ok({ accountId: destination.accountId, bucket: destination.bucket });
}

/** Publishing without an account is refused as invalid, in the words Settings would use. */
function needsAccount(): ValidationFailed {
  return {
    kind: 'validation-failed',
    issues: [
      {
        path: ['cloudflareAccountId'],
        message: publishFailureMessage(noAccount),
      },
    ],
  };
}

/**
 * Puts a built site on the web, in a bucket used only for it (D111): says
 * whether the bucket matches the site, publishes in the background (building
 * first when it has to) so the page can follow and cancel, and takes the
 * site down. What to upload and remove is worked out each time by comparing
 * with the bucket; nothing is recorded. One publish of a site runs at a time.
 */
export class SitePublishes {
  readonly #sites: SiteRepository;
  readonly #settings: SettingsRepository;
  readonly #builds: SiteBuilds;
  readonly #folders: SiteFolders;
  readonly #bucket: PublishBucket;
  readonly #errors: ErrorReporter;
  readonly #work: SiteWork;
  readonly #jobs = new Map<Slug, Job>();

  constructor(
    sites: SiteRepository,
    settings: SettingsRepository,
    builds: SiteBuilds,
    folders: SiteFolders,
    bucket: PublishBucket,
    errors: ErrorReporter,
    work: SiteWork,
  ) {
    this.#sites = sites;
    this.#settings = settings;
    this.#builds = builds;
    this.#folders = folders;
    this.#bucket = bucket;
    this.#errors = errors;
    this.#work = work;
  }

  async #target(
    ctx: ArchiveContext,
    slug: Slug,
  ): Promise<Result<Destination, NotFound | ValidationFailed>> {
    const found = await this.#sites.get(ctx, slug);
    if (found === undefined) {
      return err({ kind: 'not-found', entity: 'site', id: slug });
    }
    const target = found.site.publish;
    if (target === null) {
      return err({
        kind: 'validation-failed',
        issues: [
          { path: ['publish'], message: 'say where to publish the site' },
        ],
      });
    }
    const settings = await this.#settings.get(ctx);
    return ok({
      ...target,
      accountId: settings?.settings.cloudflareAccountId ?? null,
    });
  }

  /** Why the site can't be published or unpublished now, if something else is going on. */
  #busy(slug: Slug): Busy | undefined {
    const doing =
      this.#work.doing(slug) ??
      (this.#builds.progress(slug)?.state === 'running'
        ? 'building'
        : undefined);
    return doing === undefined
      ? undefined
      : { kind: 'busy', entity: 'site', id: slug, doing };
  }

  /** The job's progress, with the build's own while it builds first. */
  #progressOf(slug: Slug, job: Job): SitePublishProgress {
    if (job.progress.phase !== 'building' || job.progress.state !== 'running') {
      return job.progress;
    }
    const build = this.#builds.progress(slug);
    return build === undefined
      ? job.progress
      : { ...job.progress, done: build.done, total: build.total };
  }

  /** How the bucket stands against the built site now, and how the latest publish went. */
  async status(
    ctx: ArchiveContext,
    input: { readonly slug: Slug },
  ): Promise<Result<SitePublished, NotFound | ValidationFailed>> {
    const target = await this.#target(ctx, input.slug);
    if (!target.ok) {
      return target;
    }
    const job = this.#jobs.get(input.slug);
    const publish =
      job === undefined ? null : this.#progressOf(input.slug, job);
    const bucket = bucketOf(target.value);
    const listed = bucket.ok
      ? await this.#bucket.list(bucket.value, new AbortController().signal)
      : bucket;
    if (!listed.ok) {
      // The latest publish is still told, so a failed one can be read.
      return ok({
        stands: 'unknown',
        check: {
          failure: listed.error.reason,
          message: publishFailureMessage(listed.error),
        },
        publishedAt: null,
        filesToUpdate: 0,
        filesInBucket: 0,
        publish,
      });
    }
    const index = listed.value.find((file) => file.key === 'index.html');
    const state = await this.#folders.inspect(ctx, input.slug);
    const base = {
      check: null,
      publishedAt: index?.lastModified ?? null,
      filesInBucket: listed.value.length,
      publish,
    };
    if (state.kind !== 'built') {
      return ok({ ...base, stands: 'not-built', filesToUpdate: 0 });
    }
    const plan = planSitePublish({
      built: await this.#folders.describe(ctx, input.slug),
      bucket: listed.value,
    });
    const filesToUpdate = plan.uploads.length + plan.removals.length;
    return ok({
      ...base,
      filesToUpdate,
      stands:
        index === undefined
          ? 'not-published'
          : filesToUpdate === 0
            ? 'up-to-date'
            : 'needs-update',
    });
  }

  /**
   * Starts publishing the site (building it first when it isn't built or is
   * out of date), or gives the publish already running.
   */
  async start(
    ctx: ArchiveContext,
    input: { readonly slug: Slug },
  ): Promise<Result<SitePublishProgress, NotFound | ValidationFailed | Busy>> {
    const target = await this.#target(ctx, input.slug);
    if (!target.ok) {
      return target;
    }
    const bucket = bucketOf(target.value);
    if (!bucket.ok) {
      return err(needsAccount());
    }
    const running = this.#jobs.get(input.slug);
    if (running?.progress.state === 'running') {
      return ok(this.#progressOf(input.slug, running));
    }
    const busy = this.#busy(input.slug);
    if (busy !== undefined) {
      return err(busy);
    }
    const job: Job = {
      progress: {
        state: 'running',
        phase: 'building',
        done: 0,
        total: 0,
        failure: null,
        message: null,
      },
      controller: new AbortController(),
    };
    this.#jobs.set(input.slug, job);
    void this.#run(ctx, input.slug, bucket.value, job);
    return ok(job.progress);
  }

  #update(job: Job, change: Partial<SitePublishProgress>): void {
    job.progress = { ...job.progress, ...change };
  }

  #fail(job: Job, failure: PublishFailed): void {
    this.#update(job, {
      state: 'failed',
      failure: failure.reason,
      message: publishFailureMessage(failure),
    });
  }

  async #run(
    ctx: ArchiveContext,
    slug: Slug,
    target: BucketTarget,
    job: Job,
  ): Promise<void> {
    try {
      if (!(await this.#buildFirst(ctx, slug, job))) {
        return;
      }
      this.#work.begin(slug, 'publishing');
      await this.#upload(ctx, slug, target, job);
    } catch (error) {
      if (job.controller.signal.aborted) {
        this.#update(job, { state: 'cancelled' });
        return;
      }
      // The page is told it failed, in words that give no internals, and the
      // error goes to the log (D113); what was uploaded stays.
      this.#errors.report(`Couldn't publish site ${slug}`, error);
      this.#fail(job, {
        kind: 'publish-failed',
        reason: 'other',
        bucket: target.bucket,
      });
    } finally {
      this.#work.end(slug);
    }
  }

  /** Builds the site unless it's up to date; false if the publish should stop there. */
  async #buildFirst(
    ctx: ArchiveContext,
    slug: Slug,
    job: Job,
  ): Promise<boolean> {
    const status = await this.#builds.status(ctx, { slug });
    if (!status.ok || status.value.freshness !== 'up-to-date') {
      const started = await this.#builds.start(ctx, { slug });
      if (!started.ok) {
        this.#update(job, {
          state: 'failed',
          failure: 'build-failed',
          message: "Couldn't build the site, so it wasn't published.",
        });
        return false;
      }
      await this.#builds.finished(slug);
      const built = this.#builds.progress(slug);
      if (built?.state !== 'done') {
        this.#update(job, {
          state: built?.state === 'cancelled' ? 'cancelled' : 'failed',
          ...(built?.state === 'cancelled'
            ? {}
            : {
                failure: 'build-failed',
                message: "Couldn't build the site, so it wasn't published.",
              }),
        });
        return false;
      }
    }
    if (job.controller.signal.aborted) {
      this.#update(job, { state: 'cancelled' });
      return false;
    }
    return true;
  }

  async #upload(
    ctx: ArchiveContext,
    slug: Slug,
    bucket: BucketTarget,
    job: Job,
  ): Promise<void> {
    const listed = await this.#bucket.list(bucket, job.controller.signal);
    if (!listed.ok) {
      this.#fail(job, listed.error);
      return;
    }
    const plan = planSitePublish({
      built: await this.#folders.describe(ctx, slug),
      bucket: listed.value,
    });
    this.#update(job, {
      phase: 'uploading',
      done: 0,
      total: plan.uploads.length,
    });
    const uploaded = await this.#putFiles(ctx, slug, bucket, plan, job);
    if (uploaded !== 'done') {
      return;
    }
    if (plan.removals.length > 0) {
      this.#update(job, {
        phase: 'removing',
        done: 0,
        total: plan.removals.length,
      });
      const removed = await this.#bucket.deleteMany(
        bucket,
        plan.removals,
        neverStopped,
      );
      if (!removed.ok) {
        this.#fail(job, removed.error);
        return;
      }
      this.#update(job, { done: plan.removals.length });
    }
    this.#update(job, { state: 'done' });
  }

  /**
   * Puts the files in the bucket, images first and then the rest, a few at a
   * time. A cancel starts no more; those already going finish. One that
   * fails stops the others being started, and the publish with it.
   */
  async #putFiles(
    ctx: ArchiveContext,
    slug: Slug,
    bucket: BucketTarget,
    plan: SitePublishPlan,
    job: Job,
  ): Promise<'done' | 'stopped'> {
    const stop = { failed: false };
    const putOne = async (file: BuiltFile): Promise<void> => {
      const bytes = await this.#folders.read(ctx, slug, file.path);
      const kind = publishedFileKind(file.path);
      const put =
        bytes === undefined
          ? err<PublishFailed>({
              kind: 'publish-failed',
              reason: 'other',
              bucket: bucket.bucket,
            })
          : await this.#bucket.put(
              bucket,
              {
                key: file.path,
                bytes,
                contentType: kind.contentType,
                cacheControl: kind.cacheControl,
              },
              neverStopped,
            );
      if (!put.ok) {
        if (!stop.failed) {
          this.#fail(job, put.error);
        }
        stop.failed = true;
        return;
      }
      this.#update(job, { done: job.progress.done + 1 });
    };
    const groups = [
      plan.uploads.filter((file) => publishedFileKind(file.path).isImage),
      plan.uploads.filter((file) => !publishedFileKind(file.path).isImage),
    ];
    for (const group of groups) {
      let next = 0;
      const worker = async (): Promise<void> => {
        while (!stop.failed && !job.controller.signal.aborted) {
          const file = group[next];
          next += 1;
          if (file === undefined) {
            return;
          }
          await putOne(file);
        }
      };
      await Promise.all(
        Array.from({ length: Math.min(uploadsAtOnce, group.length) }, worker),
      );
      if (stop.failed) {
        return 'stopped';
      }
      if (job.controller.signal.aborted) {
        this.#update(job, { state: 'cancelled' });
        return 'stopped';
      }
    }
    return 'done';
  }

  /** Stops the publish running for the site: no more files start, those going finish, and nothing is taken back. */
  cancel(input: { readonly slug: Slug }): Result<undefined, NotFound> {
    const job = this.#jobs.get(input.slug);
    if (job?.progress.state !== 'running') {
      return err({ kind: 'not-found', entity: 'site', id: input.slug });
    }
    job.controller.abort();
    if (job.progress.phase === 'building') {
      this.#builds.cancel({ slug: input.slug });
    }
    return ok(undefined);
  }

  /** Removes every file in the bucket, taking the site down. Refused when nothing is published. */
  async unpublish(
    ctx: ArchiveContext,
    input: { readonly slug: Slug },
  ): Promise<
    Result<undefined, NotFound | ValidationFailed | Busy | PublishFailed>
  > {
    const target = await this.#target(ctx, input.slug);
    if (!target.ok) {
      return target;
    }
    const destination = bucketOf(target.value);
    if (!destination.ok) {
      return err(needsAccount());
    }
    const running = this.#jobs.get(input.slug);
    const busy =
      running?.progress.state === 'running'
        ? ({
            kind: 'busy',
            entity: 'site',
            id: input.slug,
            doing: 'publishing',
          } as const)
        : this.#busy(input.slug);
    if (busy !== undefined) {
      return err(busy);
    }
    this.#work.begin(input.slug, 'unpublishing');
    try {
      const bucket = destination.value;
      const listed = await this.#bucket.list(bucket, neverStopped);
      if (!listed.ok) {
        return listed;
      }
      if (listed.value.length === 0) {
        return err({
          kind: 'validation-failed',
          issues: [{ path: ['site'], message: 'nothing is published' }],
        });
      }
      return await this.#bucket.deleteMany(
        bucket,
        listed.value.map((file: RemoteFile) => file.key),
        neverStopped,
      );
    } finally {
      this.#work.end(input.slug);
    }
  }
}
