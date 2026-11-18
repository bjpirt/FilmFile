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
import {
  manifestAfter,
  planBackup,
  type BackupCopy,
} from '../../../domain/sync/plan-backup.ts';
import { filesAlreadyInBucket } from '../../../domain/sync/files-already-in-bucket.ts';
import type { LibraryFile } from '../../../domain/sync/library-file.ts';
import type { BackupFigure } from '../../../domain/sync/backup-figure.ts';
import { fileListOf, type FileList } from '../../../domain/sync/file-list.ts';
import { bucketKeys } from '../../../domain/sync/bucket-keys.ts';
import {
  secondsLeft,
  type UploadSample,
} from '../../../domain/sync/seconds-left.ts';
import { FirstSyncFigures } from './first-sync-figures.ts';
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
  /**
   * `waiting` for the person to say whether to remove files gone from the
   * library (FF-238); `stopping` from a cancel until the uploads going have
   * been cut off.
   */
  readonly state:
    'running' | 'waiting' | 'stopping' | 'done' | 'cancelled' | 'failed';
  /** Reading the library, listing the bucket, then uploading (FF-241). */
  readonly phase: 'checking-library' | 'checking-bucket' | 'uploading';
  readonly filesChecked: number;
  readonly filesToCheck: number;
  readonly bytesDone: number;
  readonly bytesTotal: number;
  /** Files uploaded or copied, of those to upload or copy. */
  readonly filesDone: number;
  readonly filesTotal: number;
  /** Renamed files copied inside the bucket, among those done (FF-238). */
  readonly filesCopied: number;
  /** Files gone from the library removed from the bucket, once agreed. */
  readonly filesRemoved: number;
  /** While waiting, the files it would remove. */
  readonly toRemove: FileList | null;
  /** Files a roll.json mentions that are missing on this computer, kept in the bucket. */
  readonly missing: FileList | null;
  /** Whether it's the library's first sync to the bucket, or one carrying it on. */
  readonly first: boolean;
  /** For a first sync, the whole library and how much is backed up. */
  readonly library: BackupFigure | null;
  /** About how long the upload has left, once a minute of it has been timed. */
  readonly secondsLeft: number | null;
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
  /** How far a first sync that didn't finish got, once it's known (FF-241). */
  readonly firstSync: BackupFigure | null;
  /** The latest sync since the service started, if there was one. */
  readonly run: SyncProgress | null;
}

interface Job {
  progress: SyncProgress;
  readonly controller: AbortController;
  /** How much had gone up, and when, for the time left. */
  readonly samples: UploadSample[];
  /** While waiting, gives the person's answer: whether to remove the files. */
  answer: ((remove: boolean) => void) | undefined;
}

/** A file to upload, or to copy inside the bucket from where it already is. */
type Work =
  | { readonly kind: 'upload'; readonly file: LibraryFile }
  | ({ readonly kind: 'copy' } & BackupCopy<LibraryFile>);

const recordKey = bucketKeys.syncRecord;
const manifestKey = bucketKeys.manifest;
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
  readonly #firstSyncs: FirstSyncFigures;
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
    this.#firstSyncs = new FirstSyncFigures(dependencies);
  }

  async status(ctx: ArchiveContext): Promise<SyncStatus> {
    const saved = await this.#store?.get();
    const settings = (await this.#settings.get(ctx))?.settings;
    const accountId = settings?.cloudflareAccountId ?? null;
    const bucket = saved?.bucket ?? null;
    const state = this.#job?.progress.state;
    // While a sync runs, its own figures say more, so the bucket isn't asked.
    const running =
      state === 'running' || state === 'waiting' || state === 'stopping';
    const firstSync =
      settings === undefined ||
      accountId === null ||
      bucket === null ||
      saved?.lastSync !== null
        ? null
        : running
          ? this.#firstSyncs.known({ accountId, bucket })
          : this.#firstSyncs.figure(ctx, { accountId, bucket }, settings.id);
    return {
      available: saved !== undefined,
      ready: bucket !== null && accountId !== null,
      lastSyncedAt: saved?.lastSync?.at ?? null,
      firstSync,
      run: this.#job === undefined ? null : this.#progressNow(this.#job),
    };
  }

  /** A job's progress, with the time left as of now. */
  #progressNow(job: Job): SyncProgress {
    const { progress } = job;
    if (progress.state !== 'running' || progress.phase !== 'uploading') {
      return progress;
    }
    return {
      ...progress,
      secondsLeft: secondsLeft({
        samples: job.samples,
        now: this.#clock.now().getTime(),
        remaining: progress.bytesTotal - progress.bytesDone,
      }),
    };
  }

  /** Starts a sync, or gives the one running. */
  async start(
    ctx: ArchiveContext,
  ): Promise<Result<SyncProgress, ValidationFailed>> {
    if (this.#store === undefined) {
      return err(syncNeedsTheApp);
    }
    const state = this.#job?.progress.state;
    if (
      this.#job !== undefined &&
      (state === 'running' || state === 'waiting' || state === 'stopping')
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
        phase: 'checking-library',
        filesChecked: 0,
        filesToCheck: 0,
        bytesDone: 0,
        bytesTotal: 0,
        filesDone: 0,
        filesTotal: 0,
        filesCopied: 0,
        filesRemoved: 0,
        toRemove: null,
        missing: null,
        first: false,
        library: null,
        secondsLeft: null,
        failure: null,
        message: null,
      },
      controller: new AbortController(),
      samples: [],
      answer: undefined,
    };
    this.#job = job;
    void this.#run(ctx, {
      target: { accountId, bucket: saved.bucket },
      archiveId: settings.id,
      computer: saved.computerName ?? this.#thisComputer,
      everSynced: saved.lastSync !== null,
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
    if (
      job?.progress.state !== 'running' &&
      job?.progress.state !== 'waiting'
    ) {
      return err({
        kind: 'validation-failed',
        issues: [{ path: ['sync'], message: 'no sync is running' }],
      });
    }
    this.#update(job, { state: 'stopping' });
    job.controller.abort();
    return ok(undefined);
  }

  /**
   * The person's answer to a sync waiting to remove files gone from the
   * library (FF-238, D123): remove them, or keep them for now. Either way
   * the sync carries on.
   */
  answer(remove: boolean): Result<undefined, ValidationFailed> {
    const answer = this.#job?.answer;
    if (answer === undefined) {
      return err({
        kind: 'validation-failed',
        issues: [
          { path: ['sync'], message: 'no sync is waiting for an answer' },
        ],
      });
    }
    answer(remove);
    return ok(undefined);
  }

  /** Waits for the person's answer, or a cancel. */
  #waitForAnswer(job: Job, toRemove: FileList): Promise<boolean> {
    this.#update(job, { state: 'waiting', toRemove });
    return new Promise<boolean>((resolve, reject) => {
      const cancelled = () => {
        job.answer = undefined;
        reject(new Stopped('cancelled'));
      };
      job.controller.signal.addEventListener('abort', cancelled, {
        once: true,
      });
      job.answer = (remove) => {
        job.answer = undefined;
        job.controller.signal.removeEventListener('abort', cancelled);
        this.#update(job, { state: 'running', toRemove: null });
        resolve(remove);
      };
    });
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
      /** Whether this computer has finished a sync with this bucket. */
      readonly everSynced: boolean;
      readonly store: SyncSettingsStore;
      readonly job: Job;
    },
  ): Promise<void> {
    const { target, job } = run;
    try {
      const claimed = await this.#claim(target, run.archiveId, run.computer);
      const manifest = await this.#manifest(target);
      // No manifest: no sync of this library to the bucket has finished.
      const first = !run.everSynced && manifest === undefined;
      this.#update(job, { first });
      const library = await this.#files.describe(ctx, {
        checked: (done, total) => {
          this.#update(job, { filesChecked: done, filesToCheck: total });
        },
        signal: job.controller.signal,
      });
      const plan = planBackup({
        library,
        manifest: manifest ?? [],
        mentioned: await this.#files.mentioned(ctx),
      });
      this.#update(job, {
        phase: 'checking-bucket',
        missing: fileListOf(plan.missing),
      });
      const { work, found } = await this.#notYetInBucket(target, [
        ...plan.uploads.map((file) => ({ kind: 'upload' as const, file })),
        ...plan.copies.map((copy) => ({ kind: 'copy' as const, ...copy })),
      ]);
      const toRemove = fileListOf(plan.removals);
      const remove =
        toRemove !== null && (await this.#waitForAnswer(job, toRemove));
      const sum = (files: readonly LibraryFile[]) =>
        files.reduce((total, file) => total + file.size, 0);
      job.samples.push({ at: this.#clock.now().getTime(), bytes: 0 });
      this.#update(job, {
        phase: 'uploading',
        bytesTotal: sum(
          work.flatMap((item) => (item.kind === 'upload' ? [item.file] : [])),
        ),
        filesTotal: work.length,
        library: first
          ? {
              bytes: sum(library),
              files: library.length,
              bytesBackedUp: sum(found),
              filesBackedUp: found.length,
            }
          : null,
      });
      const sent = await this.#send(ctx, target, work, job);
      // Removed last, so a sync cut short before here removed nothing (D117).
      const removed = [
        ...plan.renamed,
        ...(remove ? plan.removals.map((file) => file.path) : []),
      ];
      if (removed.length > 0) {
        this.#must(
          await this.#bucket.deleteMany(target, removed, job.controller.signal),
        );
      }
      this.#update(job, { filesRemoved: remove ? plan.removals.length : 0 });
      const at = this.#clock.now().toISOString();
      const after = manifestAfter(manifest ?? [], [...found, ...sent], removed);
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
      this.#firstSyncs.set(target, null);
    } catch (error) {
      if (job.progress.first) {
        this.#firstSyncs.set(target, job.progress.library);
      }
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
   * Of the files to upload or copy, those the bucket doesn't already have at
   * their paths, and those it does, sent by a sync that didn't finish (D122).
   * The bucket is listed only when there's something to do.
   */
  async #notYetInBucket(
    target: BucketTarget,
    work: readonly Work[],
  ): Promise<{
    readonly work: readonly Work[];
    readonly found: readonly LibraryFile[];
  }> {
    if (work.length === 0) {
      return { work, found: [] };
    }
    const listing = this.#must(
      await this.#bucket.list(target, new AbortController().signal),
    );
    const { found } = filesAlreadyInBucket({
      uploads: work.map((item) => item.file),
      listing,
    });
    const there = new Set(found.map((file) => file.path));
    return {
      work: work.filter((item) => !there.has(item.file.path)),
      found,
    };
  }

  /** The bucket's manifest from the last sync: none before the first has finished. */
  async #manifest(
    target: BucketTarget,
  ): Promise<readonly ManifestEntry[] | undefined> {
    const got = this.#must(
      await this.#bucket.get(target, manifestKey, new AbortController().signal),
    );
    if (got === undefined) {
      return undefined;
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
   * Streams the files to the bucket a few at a time, and copies renamed ones
   * inside it, uploading one whose old copy has gone. A cancel cuts off
   * those going and starts no more; one that fails stops the rest being
   * started. Gives what was sent or copied, with the SHA-256 of the bytes
   * that went.
   */
  async #send(
    ctx: ArchiveContext,
    target: BucketTarget,
    work: readonly Work[],
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
        const item = work[next];
        next += 1;
        if (item === undefined) {
          return;
        }
        const { file } = item;
        if (item.kind === 'copy') {
          const copied = await this.#bucket
            .copy(
              target,
              { from: item.from, to: file.path },
              job.controller.signal,
            )
            .catch((error: unknown) => {
              if (cancelled()) {
                return undefined;
              }
              throw error;
            });
          if (copied === undefined) {
            return;
          }
          if (copied.ok) {
            sent.push({
              path: file.path,
              size: file.size,
              sha256: file.sha256,
            });
            const { filesDone, filesCopied } = job.progress;
            this.#update(job, {
              filesDone: filesDone + 1,
              filesCopied: filesCopied + 1,
            });
            continue;
          }
          if (copied.error.kind === 'publish-failed') {
            stop.reason ??= copied.error.reason;
            return;
          }
          // The old copy has gone from the bucket: send the file instead.
          this.#update(job, {
            bytesTotal: job.progress.bytesTotal + file.size,
          });
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
        const { bytesDone, filesDone, library } = job.progress;
        this.#update(job, {
          bytesDone: bytesDone + file.size,
          filesDone: filesDone + 1,
          library:
            library === null
              ? null
              : {
                  ...library,
                  bytesBackedUp: library.bytesBackedUp + file.size,
                  filesBackedUp: library.filesBackedUp + 1,
                },
        });
        job.samples.push({
          at: this.#clock.now().getTime(),
          bytes: bytesDone + file.size,
        });
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(uploadsAtOnce, work.length) }, worker),
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
