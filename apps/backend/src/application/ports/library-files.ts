import type { LibraryFile } from '../../domain/sync/library-file.ts';
import type { ArchiveContext } from '../../domain/shared/archive-context.ts';

/** Following a library being checked before a sync. */
export interface CheckingWatch {
  /** Told how many files have been checked, of how many: first with none. */
  readonly checked: (done: number, total: number) => void;
  readonly signal: AbortSignal;
}

/**
 * The files a sync backs up (D117): everything under `Library/`, and the
 * FilmFile folder's `settings.json`, by their paths from the folder. Names
 * starting with `.` are left out (D120). Hashing (SHA-256 and MD5, D122) is cached by path, size and
 * modified time, so a file that hasn't changed isn't read again.
 */
export interface LibraryFiles {
  /**
   * Every file to back up, with its size, SHA-256 and MD5, by path. With a
   * watch, it says how many files it has checked as it goes (FF-241), and
   * rejects once the signal is aborted.
   */
  describe(
    ctx: ArchiveContext,
    watch?: CheckingWatch,
  ): Promise<readonly LibraryFile[]>;
  /** Every file to back up with its size, by path, reading none of them. */
  sizes(
    ctx: ArchiveContext,
  ): Promise<readonly { readonly path: string; readonly size: number }[]>;
  /** A file's bytes as a stream, read as it's sent; refuses a path outside the folder. */
  read(ctx: ArchiveContext, path: string): ReadableStream<Uint8Array>;
}
