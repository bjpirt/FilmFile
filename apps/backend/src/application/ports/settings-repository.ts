import type { Settings } from '../../domain/settings/settings.ts';
import type { ArchiveContext } from '../../domain/shared/archive-context.ts';
import type {
  AlreadyExists,
  ConcurrencyConflict,
  NotFound,
} from '../../domain/shared/domain-error.ts';
import type { Result } from '../../domain/shared/result.ts';

/**
 * The settings and their version token. The token changes whenever they're
 * saved; passing it back to `save` refuses the save if they've changed since
 * they were read.
 */
export interface VersionedSettings {
  readonly settings: Settings;
  readonly version: string;
}

/**
 * Where FilmFile's settings are kept: settings.json at the FilmFile folder's
 * top level, beside the library, or memory in tests. There are none until
 * FilmFile is set up.
 */
export interface SettingsRepository {
  /** The settings, or undefined if FilmFile hasn't been set up. */
  get(ctx: ArchiveContext): Promise<VersionedSettings | undefined>;

  /** Sets FilmFile up; fails if it already is, keeping what's there. */
  create(
    ctx: ArchiveContext,
    settings: Settings,
  ): Promise<Result<void, AlreadyExists>>;

  /**
   * Replaces the settings, if they haven't changed since they were read as
   * `expectedVersion`. Returns the new version.
   */
  save(
    ctx: ArchiveContext,
    settings: Settings,
    expectedVersion: string,
  ): Promise<Result<string, NotFound | ConcurrencyConflict>>;
}
