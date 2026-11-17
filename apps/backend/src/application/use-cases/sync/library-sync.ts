import type { ArchiveContext } from '../../../domain/shared/archive-context.ts';
import type {
  PublishFailed,
  ValidationFailed,
} from '../../../domain/shared/domain-error.ts';
import { err, ok, type Result } from '../../../domain/shared/result.ts';
import type {
  ManifestEntry,
  SyncRecord,
} from '../../../domain/sync/manifest.ts';
import { manifestAfter, planBackup } from '../../../domain/sync/plan-backup.ts';
import { filesAlreadyInBucket } from '../../../domain/sync/files-already-in-bucket.ts';
import type { LibraryFile } from '../../../domain/sync/library-file.ts';
import {
  manifestText,
  parseManifest,
  parseSyncRecord,
  syncRecordText,
} from '../../../domain/sync/sync-files.ts';
import {
  syncFailureMessage,
  type SyncFailureReason,
} from '../../../domain/sync/sync-failure-message.ts';
import type { Clock } from '../../ports/clock.ts';
import type { ErrorReporter } from '../../ports/error-reporter.ts';
import type { LibraryFiles } from '../../ports/library-files.ts';
import type {
  BucketTarget,
  PublishBucket,
} from '../../ports/publish-bucket.ts';
import type { SettingsRepository } from '../../ports/settings-repository.ts';
import type { SyncSettingsStore } from '../../ports/sync-settings-store.ts';
import { syncNeedsTheApp } from './save-sync-settings.ts';

/** Where a sync has got to. */
export interface SyncProgress {
  /** `stopping` from a cancel until the uploads going have been cut off. */
  readonly state: 'running' | 'stopping' | 'done' | 'cancelled' | 'failed';
  readonly bytesDone: number;
  readonly bytesTotal: number;
  readonly filesDone: number;
  readonly filesTotal: number;
  /** Why it failed, if it did. */
  readonly failure: SyncFailureReason | null;
  /** What to fix, in words, when it failed. */
  readonly message: string | null;
}

/** How syncing stands on this computer. */
export interface SyncStatus {
  readonly available: boolean;
  /** Whether a sync can be started: available, with the account ID and a bucket set. */
  readonly ready: boolean;
  /** When this computer last finished a sync, an ISO 8601 time. */
  readonly lastSyncedAt: string | null;
  /** The latest sync since the service started, if there was one. */
  readonly run: SyncProgress | null;
}

interface Job {
  progress: SyncProgress;
  readonly controller: AbortController;
}

const recordKey = 'filmfile/sync.json';
const manifestKey = 'filmfile/manifest.json';
// How many files go up at once; each is streamed, so memory stays small (D120).
const uploadsAtOnce = 4;

const asFile = (text: string) => ({
  bytes: new TextEncoder().encode(text),
  contentType: 'application/json',
  cacheControl: 'no-store',
});

const textOf = (bytes: Uint8Array) => new TextDecoder().decode(bytes);

/** A sync stopped for a reason, carrying it to the job. */
class Stopped extends Error {
  readonly reason: SyncFailureReason | 'cancelled';

  constructor(reason: SyncFailureReason | 'cancelled') {
    super(`sync stopped: ${reason}`);
    this.reason = reason;
  }
}

/**
 * Backs the library up to this computer's bucket (FF-225, D117): claims an
 * empty bucket for the library, sends what's new or changed since the
 * bucket's manifest, skipping what the bucket already has from a sync that
 * didn't finish (D122), and only then writes the manifest and the sync record,
 * conditionally on the record read at the start. A sync cut short leaves the
 * record as it was. Runs in the background so the page can follow and
 * cancel; one at a time.
 */
export class LibrarySync {
  readonly #store: SyncSettingsStore | undefined;
  readonly #settings: SettingsRepository;
  readonly #files: LibraryFiles;
  readonly #bucket: PublishBucket;
  readonly #clock: Clock;
  readonly #errors: ErrorReporter;
  readonly #thisComputer: string;
  #job: Job | undefined;

  constructor(dependencies: {
    readonly store: SyncSettingsStore | undefined;
    readonly settings: SettingsRepository;
    readonly files: LibraryFiles;
    readonly bucket: PublishBucket;
    readonly clock: Clock;
    readonly errors: ErrorReporter;
    readonly thisComputer: string;
  }) {
    this.#store = dependencies.store;
    this.#settings = dependencies.settings;
    this.#files = dependencies.files;
    this.#bucket = dependencies.bucket;
    this.#clock = dependencies.clock;
    this.#errors = dependencies.errors;
    this.#thisComputer = dependencies.thisComputer;
  }

  async status(ctx: ArchiveContext): Promise<SyncStatus> {
    const saved = await this.#store?.get();
    const accountId =
      (await this.#settings.get(ctx))?.settings.cloudflareAccountId ?? null;
    return {
      available: saved !== undefined,
      ready: (saved?.bucket ?? null) !== null && accountId !== null,
      lastSyncedAt: saved?.lastSync?.at ?? null,
      run: this.#job?.progress ?? null,
    };
  }

  /** Starts a sync, or gives the one running. */
  async start(
    ctx: ArchiveContext,
  ): Promise<Result<SyncProgress, ValidationFailed>> {
    if (this.#store === undefined) {
      return err(syncNeedsTheApp);
    }
    if (
      this.#job?.progress.state === 'running' ||
      this.#job?.progress.state === 'stopping'
    ) {
      return ok(this.#job.progress);
    }
    const saved = await this.#store.get();
    const settings = (await this.#settings.get(ctx))?.settings;
    const accountId = settings?.cloudflareAccountId ?? null;
    if (accountId === null || settings === undefined) {
      return err({
        kind: 'validation-failed',
        issues: [
          {
            path: ['cloudflareAccountId'],
            message: syncFailureMessage('no-account', ''),
          },
        ],
      });
    }
    if (saved.bucket === null) {
      return err({
        kind: 'validation-failed',
        issues: [
          { path: ['bucket'], message: 'say which bucket to sync with' },
        ],
      });
    }
    const job: Job = {
      progress: {
        state: 'running',
        bytesDone: 0,
        bytesTotal: 0,
        filesDone: 0,
        filesTotal: 0,
        failure: null,
        message: null,
      },
      controller: new AbortController(),
    };
    this.#job = job;
    void this.#run(ctx, {
      target: { accountId, bucket: saved.bucket },
      archiveId: settings.id,
      computer: saved.computerName ?? this.#thisComputer,
      store: this.#store,
      job,
    });
    return ok(job.progress);
  }

  /**
   * Stops the sync running (FF-240): the uploads going are cut off, no more
   * start, and the bucket's record stays as it was. It reads `stopping`
   * until they have. Asking again while it stops is no failure.
   */
  cancel(): Result<undefined, ValidationFailed> {
    const job = this.#job;
    if (job?.progress.state === 'stopping') {
      return ok(undefined);
    }
    if (job?.progress.state !== 'running') {
      return err({
        kind: 'validation-failed',
        issues: [{ path: ['sync'], message: 'no sync is running' }],
      });
    }
    this.#update(job, { state: 'stopping' });
    job.controller.abort();
    return ok(undefined);
  }

  #update(job: Job, change: Partial<SyncProgress>): void {
    job.progress = { ...job.progress, ...change };
  }

  async #run(
    ctx: ArchiveContext,
    run: {
      readonly target: BucketTarget;
      readonly archiveId: string;
      readonly computer: string;
      readonly store: SyncSettingsStore;
      readonly job: Job;
    },
  ): Promise<void> {
    const { target, job } = run;
    try {
      const claimed = await this.#claim(target, run.archiveId, run.computer);
      const manifest = await this.#manifest(target);
      const plan = planBackup({
        library: await this.#files.describe(ctx),
        manifest,
      });
      const { uploads, found } = await this.#notYetInBucket(
        target,
        plan.uploads,
      );
      this.#update(job, {
        bytesTotal: uploads.reduce((total, file) => total + file.size, 0),
        filesTotal: uploads.length,
      });
      const sent = await this.#send(ctx, target, uploads, job);
      const at = this.#clock.now().toISOString();
      const after = manifestAfter(manifest, [...found, ...sent]);
      this.#must(
        await this.#bucket.put(
          target,
          { key: manifestKey, ...asFile(manifestText(after)) },
          new AbortController().signal,
        ),
      );
      const record: SyncRecord = {
        archiveId: run.archiveId,
        sync: claimed.record.sync + 1,
        computer: run.computer,
        at,
      };
      const written = await this.#bucket.putIf(
        target,
        { key: recordKey, ...asFile(syncRecordText(record)) },
        { ifMatch: claimed.etag },
        new AbortController().signal,
      );
      if (!written.ok) {
        if (written.error.kind === 'precondition-failed') {
          this.#errors.report(
            `Couldn't sync to ${target.bucket}`,
            'its sync record changed while this sync ran',
          );
          throw new Stopped('other');
        }
        throw new Stopped(written.error.reason);
      }
      const current = await run.store.get();
      await run.store.save({
        ...current,
        lastSync: { sync: record.sync, at },
      });
      this.#update(job, { state: 'done' });
    } catch (error) {
      if (error instanceof Stopped || job.controller.signal.aborted) {
        const reason = error instanceof Stopped ? error.reason : 'cancelled';
        this.#update(
          job,
          reason === 'cancelled'
            ? { state: 'cancelled' }
            : {
                state: 'failed',
                failure: reason,
                message: syncFailureMessage(reason, target.bucket),
              },
        );
        return;
      }
      // Told in words that give no internals; the error goes to the log (D113).
      this.#errors.report(`Couldn't sync to ${target.bucket}`, error);
      this.#update(job, {
        state: 'failed',
        failure: 'other',
        message: syncFailureMessage('other', target.bucket),
      });
    }
  }

  /** The value of a bucket's answer, or the sync stops with its reason. */
  #must<T>(result: Result<T, PublishFailed>): T {
    if (!result.ok) {
      throw new Stopped(result.error.reason);
    }
    return result.value;
  }

  /**
   * The bucket's sync record and its ETag: this library's, or a new one
   * claiming an empty bucket. A bucket with other things in it, or another
   * library's, is refused before anything is sent.
   */
  async #claim(
    target: BucketTarget,
    archiveId: string,
    computer: string,
  ): Promise<{ readonly record: SyncRecord; readonly etag: string }> {
    const signal = new AbortController().signal;
    const got = this.#must(await this.#bucket.get(target, recordKey, signal));
    if (got !== undefined) {
      const record = parseSyncRecord(textOf(got.bytes));
      if (record === undefined) {
        throw new Stopped('not-empty');
      }
      if (record.archiveId !== archiveId) {
        throw new Stopped('another-library');
      }
      return { record, etag: got.etag };
    }
    if (this.#must(await this.#bucket.list(target, signal)).length > 0) {
      throw new Stopped('not-empty');
    }
    const record: SyncRecord = {
      archiveId,
      sync: 0,
      computer,
      at: this.#clock.now().toISOString(),
    };
    const claimed = await this.#bucket.putIf(
      target,
      { key: recordKey, ...asFile(syncRecordText(record)) },
      { ifNoneMatch: true },
      signal,
    );
    if (!claimed.ok) {
      throw new Stopped(
        claimed.error.kind === 'precondition-failed'
          ? 'not-empty'
          : claimed.error.reason,
      );
    }
    return { record, etag: claimed.value.etag };
  }

  /**
   * Of the files to upload, those the bucket doesn't already have, and those
   * it does, sent by a sync that didn't finish (D122). The bucket is listed
   * only when there's something to upload.
   */
  async #notYetInBucket(
    target: BucketTarget,
    uploads: readonly LibraryFile[],
  ): Promise<{
    readonly uploads: readonly LibraryFile[];
    readonly found: readonly LibraryFile[];
  }> {
    if (uploads.length === 0) {
      return { uploads, found: [] };
    }
    const listing = this.#must(
      await this.#bucket.list(target, new AbortController().signal),
    );
    return filesAlreadyInBucket({ uploads, listing });
  }

  /** The bucket's manifest from the last sync: none before the first. */
  async #manifest(target: BucketTarget): Promise<readonly ManifestEntry[]> {
    const got = this.#must(
      await this.#bucket.get(target, manifestKey, new AbortController().signal),
    );
    if (got === undefined) {
      return [];
    }
    const manifest = parseManifest(textOf(got.bytes));
    if (manifest === undefined) {
      this.#errors.report(
        `Couldn't sync to ${target.bucket}`,
        'its manifest could not be read',
      );
      throw new Stopped('other');
    }
    return manifest;
  }

  /**
   * Streams the files to the bucket a few at a time. A cancel cuts off
   * those going and starts no more; one that fails stops the rest being
   * started. Gives what was sent,
   * with the SHA-256 of the bytes that went.
   */
  async #send(
    ctx: ArchiveContext,
    target: BucketTarget,
    uploads: readonly LibraryFile[],
    job: Job,
  ): Promise<readonly ManifestEntry[]> {
    const sent: ManifestEntry[] = [];
    const stop: { reason: SyncFailureReason | undefined } = {
      reason: undefined,
    };
    let next = 0;
    // Asked afresh each time: a cancel can come while an upload is going.
    const cancelled = () => job.controller.signal.aborted;
    const worker = async (): Promise<void> => {
      while (stop.reason === undefined && !job.controller.signal.aborted) {
        const file = uploads[next];
        next += 1;
        if (file === undefined) {
          return;
        }
        let put;
        try {
          put = await this.#bucket.putStream(
            target,
            {
              key: file.path,
              size: file.size,
              contentType: 'application/octet-stream',
              body: this.#files.read(ctx, file.path),
            },
            // A cancel cuts the upload off; it never reaches the bucket, so
            // the next sync sends it (D122).
            job.controller.signal,
          );
        } catch (error) {
          if (cancelled()) {
            return;
          }
          throw error;
        }
        if (!put.ok) {
          stop.reason ??= put.error.reason;
          return;
        }
        sent.push({
          path: file.path,
          size: file.size,
          sha256: put.value.sha256,
        });
        this.#update(job, {
          bytesDone: job.progress.bytesDone + file.size,
          filesDone: job.progress.filesDone + 1,
        });
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(uploadsAtOnce, uploads.length) }, worker),
    );
    if (stop.reason !== undefined) {
      throw new Stopped(stop.reason);
    }
    if (job.controller.signal.aborted) {
      throw new Stopped('cancelled');
    }
    return sent;
  }
}
