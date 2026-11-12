import type { ArchiveContext } from '../../../domain/shared/archive-context.ts';
import type { NotFound } from '../../../domain/shared/domain-error.ts';
import type { Result } from '../../../domain/shared/result.ts';
import type { Slug } from '../../../domain/shared/slug.ts';
import type { Clock } from '../../ports/clock.ts';
import type { SiteRepository } from '../../ports/site-repository.ts';

/**
 * Deletes a site's definition: its file moves to the archive's `deleted/`,
 * where only the user empties it. A folder it built in `Sites/` is left where
 * it is.
 */
export class DeleteSite {
  readonly #sites: SiteRepository;
  readonly #clock: Clock;

  constructor(sites: SiteRepository, clock: Clock) {
    this.#sites = sites;
    this.#clock = clock;
  }

  execute(
    ctx: ArchiveContext,
    input: { readonly slug: Slug },
  ): Promise<Result<void, NotFound>> {
    return this.#sites.remove(ctx, input.slug, this.#clock.now());
  }
}
