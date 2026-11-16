import type { ManifestEntry } from '../../domain/sync/manifest.ts';
import type { ArchiveContext } from '../../domain/shared/archive-context.ts';

/**
 * The files a sync backs up (D117): everything under `Library/`, and the
 * FilmFile folder's `settings.json`, by their paths from the folder. Names
 * starting with `.` are left out (D120). Hashing is cached by path, size and
 * modified time, so a file that hasn't changed isn't read again.
 */
export interface LibraryFiles {
  /** Every file to back up, with its size and SHA-256, by path. */
  describe(ctx: ArchiveContext): Promise<readonly ManifestEntry[]>;
  /** A file's bytes as a stream, read as it's sent; refuses a path outside the folder. */
  read(ctx: ArchiveContext, path: string): ReadableStream<Uint8Array>;
}
