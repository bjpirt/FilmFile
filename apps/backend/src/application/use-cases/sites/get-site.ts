import type { ArchiveContext } from '../../../domain/shared/archive-context.ts';
import type { NotFound } from '../../../domain/shared/domain-error.ts';
import { err, ok, type Result } from '../../../domain/shared/result.ts';
import type { Slug } from '../../../domain/shared/slug.ts';
import type {
  SiteRepository,
  VersionedSite,
} from '../../ports/site-repository.ts';

/** A site by its slug, with its version for saving changes against. */
export class GetSite {
  readonly #sites: SiteRepository;

  constructor(sites: SiteRepository) {
    this.#sites = sites;
  }

  async execute(
    ctx: ArchiveContext,
    input: { readonly slug: Slug },
  ): Promise<Result<VersionedSite, NotFound>> {
    const found = await this.#sites.get(ctx, input.slug);
    return found === undefined
      ? err({ kind: 'not-found', entity: 'site', id: input.slug })
      : ok(found);
  }
}
