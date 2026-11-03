import type { Archive } from '../../domain/archive/archive.ts';
import type { ArchiveContext } from '../../domain/shared/archive-context.ts';
import type {
  AlreadyExists,
  ConcurrencyConflict,
  NotFound,
} from '../../domain/shared/domain-error.ts';
import type { Result } from '../../domain/shared/result.ts';

/**
 * The archive and its version token. The token changes whenever the archive
 * is saved; passing it back to `save` refuses the save if the archive has
 * changed since it was read.
 */
export interface VersionedArchive {
  readonly archive: Archive;
  readonly version: string;
}

/**
 * Where the archive's own details are kept: archive.json at the archive's
 * root, or memory in tests. There's none until the archive is set up.
 */
export interface ArchiveRepository {
  /** The archive, or undefined if it hasn't been set up. */
  get(ctx: ArchiveContext): Promise<VersionedArchive | undefined>;

  /** Sets the archive up; fails if it already is, keeping what's there. */
  create(
    ctx: ArchiveContext,
    archive: Archive,
  ): Promise<Result<void, AlreadyExists>>;

  /**
   * Replaces the archive's details, if they haven't changed since they were
   * read as `expectedVersion`. Returns the new version.
   */
  save(
    ctx: ArchiveContext,
    archive: Archive,
    expectedVersion: string,
  ): Promise<Result<string, NotFound | ConcurrencyConflict>>;
}
