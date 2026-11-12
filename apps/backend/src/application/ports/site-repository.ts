import type { Site } from '../../domain/sites/site.ts';
import type { ArchiveContext } from '../../domain/shared/archive-context.ts';
import type {
  AlreadyExists,
  ConcurrencyConflict,
  NotFound,
} from '../../domain/shared/domain-error.ts';
import type { Result } from '../../domain/shared/result.ts';
import type { Slug } from '../../domain/shared/slug.ts';

/** A site and its version token, which changes whenever it's saved. */
export interface VersionedSite {
  readonly site: Site;
  readonly version: string;
}

/**
 * Where the archive's sites are kept: a JSON file per site,
 * `Library/sites/<slug>.json`, or memory in tests (D91). Sites are found by
 * slug, which follows the name.
 */
export interface SiteRepository {
  /** Every site, ordered by name. */
  list(ctx: ArchiveContext): Promise<readonly Site[]>;

  get(ctx: ArchiveContext, slug: Slug): Promise<VersionedSite | undefined>;

  /** Adds a new site; fails if another site has its slug. */
  create(
    ctx: ArchiveContext,
    site: Site,
  ): Promise<Result<string, AlreadyExists>>;

  /**
   * Replaces a site, if it hasn't changed since it was read as
   * `expectedVersion`. Returns the new version.
   */
  save(
    ctx: ArchiveContext,
    site: Site,
    expectedVersion: string,
  ): Promise<Result<string, NotFound | ConcurrencyConflict>>;

  /**
   * Replaces the site at `from` with `site`, which has another slug, if it
   * hasn't changed since it was read as `expectedVersion`; fails if another
   * site has the new slug, leaving both as they were. Returns the new version.
   */
  rename(
    ctx: ArchiveContext,
    from: Slug,
    site: Site,
    expectedVersion: string,
  ): Promise<Result<string, NotFound | ConcurrencyConflict | AlreadyExists>>;

  /**
   * Takes a site away, its file going to the archive's `deleted/` where only
   * the user empties it, dated `at` (D12). What it built in `Sites/` is left
   * alone.
   */
  remove(
    ctx: ArchiveContext,
    slug: Slug,
    at: Date,
  ): Promise<Result<void, NotFound>>;
}
