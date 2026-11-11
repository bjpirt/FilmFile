import type { ArchiveContext } from '../../../domain/shared/archive-context.ts';
import type {
  NotFound,
  ValidationFailed,
} from '../../../domain/shared/domain-error.ts';
import { err, ok, type Result } from '../../../domain/shared/result.ts';
import type {
  ExportDestination,
  ExportFolder,
} from '../../ports/export-destination.ts';
import type { QuickExport } from '../../ports/export-tickets.ts';
import type { RollRepository } from '../../ports/roll-repository.ts';
import type { MakeQuickExport } from './make-quick-export.ts';
import { checkExport } from './prepare-quick-export.ts';

/** Where an export written into a folder has got to. */
export interface FolderExportStatus {
  readonly state: 'running' | 'done' | 'cancelled' | 'failed';
  /** Frames dealt with so far, made or left out. */
  readonly done: number;
  readonly total: number;
  /** JPEGs written. */
  readonly written: number;
  /** Frames that couldn't be made. */
  readonly leftOut: number;
}

interface Job {
  status: FolderExportStatus;
  cancelled: boolean;
}

/** How many finished exports are remembered, for a page that asks after one. */
const remembered = 20;

/**
 * Exports several frames straight into a folder the person chooses (D100):
 * the destination asks for it (the desktop app, with its own dialog), then the
 * frames are made one after another and written there, in the background, so
 * the page can follow progress and cancel. A frame that can't be made is left
 * out and listed in `skipped.txt`; cancelling stops after the file in
 * progress and keeps what's written.
 */
export class FolderExports {
  readonly #rolls: RollRepository;
  readonly #making: MakeQuickExport;
  readonly #destination: ExportDestination | undefined;
  readonly #jobs = new Map<string, Job>();
  #next = 0;

  constructor(
    rolls: RollRepository,
    making: MakeQuickExport,
    destination: ExportDestination | undefined,
  ) {
    this.#rolls = rolls;
    this.#making = making;
    this.#destination = destination;
  }

  /**
   * Checks the frames, asks for a folder and starts writing. Gives the export's
   * ID, or undefined if the person cancelled the folder chooser.
   */
  async start(
    ctx: ArchiveContext,
    input: Omit<QuickExport, 'output'>,
  ): Promise<Result<string | undefined, NotFound | ValidationFailed>> {
    if (this.#destination === undefined) {
      return err({
        kind: 'validation-failed',
        issues: [
          {
            path: ['output'],
            message:
              'exporting to a folder is only available in the desktop app',
          },
        ],
      });
    }
    const quick: QuickExport = { ...input, output: 'zip' };
    const checked = await checkExport(this.#rolls, ctx, quick);
    if (!checked.ok) {
      return checked;
    }
    const folder = await this.#destination.choose();
    if (folder === undefined) {
      return ok(undefined);
    }
    this.#next += 1;
    const id = String(this.#next);
    const job: Job = {
      status: {
        state: 'running',
        done: 0,
        total: quick.frames.length,
        written: 0,
        leftOut: 0,
      },
      cancelled: false,
    };
    this.#jobs.set(id, job);
    this.#forget();
    void this.#run(ctx, quick, folder, job, this.#destination);
    return ok(id);
  }

  status(id: string): Result<FolderExportStatus, NotFound> {
    const job = this.#jobs.get(id);
    return job === undefined
      ? err({ kind: 'not-found', entity: 'export', id })
      : ok(job.status);
  }

  /** Stops an export after the file in progress, keeping what's written. */
  cancel(id: string): Result<undefined, NotFound> {
    const job = this.#jobs.get(id);
    if (job === undefined) {
      return err({ kind: 'not-found', entity: 'export', id });
    }
    job.cancelled = true;
    return ok(undefined);
  }

  /** Forgets the oldest finished exports beyond the few remembered. */
  #forget(): void {
    const finished = [...this.#jobs].filter(
      ([, job]) => job.status.state !== 'running',
    );
    for (const [id] of finished.slice(
      0,
      Math.max(finished.length - remembered, 0),
    )) {
      this.#jobs.delete(id);
    }
  }

  async #run(
    ctx: ArchiveContext,
    quick: QuickExport,
    folder: ExportFolder,
    job: Job,
    destination: ExportDestination,
  ): Promise<void> {
    const update = (change: Partial<FolderExportStatus>) => {
      job.status = { ...job.status, ...change };
    };
    const entries = this.#making.entries(ctx, quick);
    try {
      for await (const { name, data } of entries) {
        if (job.cancelled) {
          break;
        }
        await folder.write(name, data);
        if (name !== 'skipped.txt') {
          update({
            written: job.status.written + 1,
            done: job.status.done + 1,
          });
        }
      }
      const leftOut = job.status.total - job.status.written;
      update({
        state: job.cancelled ? 'cancelled' : 'done',
        done: job.cancelled ? job.status.done : job.status.total,
        leftOut: job.cancelled ? 0 : leftOut,
      });
      destination.finished({
        folder: folder.path,
        written: job.status.written,
        leftOut: job.status.leftOut,
      });
    } catch {
      // The page is told it failed, in words that give no internals; what was
      // written stays, since files are only ever written whole.
      update({ state: 'failed' });
    } finally {
      await entries.return(undefined);
    }
  }
}
