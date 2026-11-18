import type { ArchiveContext } from '../../../domain/shared/archive-context.ts';
import {
  firstSyncFigure,
  type BackupFigure,
} from '../../../domain/sync/backup-figure.ts';
import { bucketKeys } from '../../../domain/sync/bucket-keys.ts';
import { parseSyncRecord } from '../../../domain/sync/sync-files.ts';
import type { ErrorReporter } from '../../ports/error-reporter.ts';
import type { LibraryFiles } from '../../ports/library-files.ts';
import type {
  BucketTarget,
  PublishBucket,
} from '../../ports/publish-bucket.ts';

const keyOf = (target: BucketTarget) => `${target.accountId}/${target.bucket}`;

/**
 * How far a first sync that didn't finish got, by bucket (FF-241), kept
 * while the service runs. The first time it's asked for a bucket it lists it
 * in the background, once, and gives null meanwhile: a bucket claimed by
 * this library with no manifest gives the library's files there at the same
 * path and size. A bucket that can't be reached, is empty, or has a
 * manifest gives null. A sync that stops sets the figure from its own count.
 */
export class FirstSyncFigures {
  readonly #bucket: PublishBucket;
  readonly #files: LibraryFiles;
  readonly #errors: ErrorReporter;
  readonly #known = new Map<string, BackupFigure | null>();
  readonly #asked = new Set<string>();

  constructor(dependencies: {
    readonly bucket: PublishBucket;
    readonly files: LibraryFiles;
    readonly errors: ErrorReporter;
  }) {
    this.#bucket = dependencies.bucket;
    this.#files = dependencies.files;
    this.#errors = dependencies.errors;
  }

  /** The figure as known, asking the bucket the first time. */
  figure(
    ctx: ArchiveContext,
    target: BucketTarget,
    archiveId: string,
  ): BackupFigure | null {
    const key = keyOf(target);
    if (!this.#asked.has(key)) {
      this.#asked.add(key);
      void this.#ask(ctx, target, archiveId);
    }
    return this.#known.get(key) ?? null;
  }

  /** The figure as known, without asking the bucket. */
  known(target: BucketTarget): BackupFigure | null {
    return this.#known.get(keyOf(target)) ?? null;
  }

  /** What a sync found: how far a first sync that stopped got, or null once one finishes. */
  set(target: BucketTarget, figure: BackupFigure | null): void {
    this.#asked.add(keyOf(target));
    this.#known.set(keyOf(target), figure);
  }

  async #ask(
    ctx: ArchiveContext,
    target: BucketTarget,
    archiveId: string,
  ): Promise<void> {
    const key = keyOf(target);
    try {
      const figure = await this.#figureFromBucket(ctx, target, archiveId);
      // A sync that ran meanwhile knows better.
      if (!this.#known.has(key)) {
        this.#known.set(key, figure);
      }
    } catch (error) {
      this.#errors.report(
        `Couldn't work out how far the first sync to ${target.bucket} got`,
        error,
      );
    }
  }

  async #figureFromBucket(
    ctx: ArchiveContext,
    target: BucketTarget,
    archiveId: string,
  ): Promise<BackupFigure | null> {
    const signal = new AbortController().signal;
    const listed = await this.#bucket.list(target, signal);
    if (!listed.ok) {
      return null;
    }
    const keys = new Set(listed.value.map((file) => file.key));
    if (!keys.has(bucketKeys.syncRecord) || keys.has(bucketKeys.manifest)) {
      return null;
    }
    const got = await this.#bucket.get(target, bucketKeys.syncRecord, signal);
    if (!got.ok || got.value === undefined) {
      return null;
    }
    const record = parseSyncRecord(new TextDecoder().decode(got.value.bytes));
    if (record?.archiveId !== archiveId) {
      return null;
    }
    return firstSyncFigure({
      library: await this.#files.sizes(ctx),
      listing: listed.value,
    });
  }
}
