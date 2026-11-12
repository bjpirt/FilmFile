import type { ArchiveContext } from '../../../domain/shared/archive-context.ts';
import type {
  AlreadyExists,
  ValidationFailed,
} from '../../../domain/shared/domain-error.ts';
import { err, ok, type Result } from '../../../domain/shared/result.ts';
import { slugFor } from '../../../domain/shared/slug.ts';
import type { Site } from '../../../domain/sites/site.ts';
import type { IdGenerator } from '../../ports/id-generator.ts';
import type {
  SiteRepository,
  VersionedSite,
} from '../../ports/site-repository.ts';

/**
 * Adds a site, named as given, with a slug made from its name. It starts with
 * no rules, so every frame is on it until rules are set (D93).
 */
export class CreateSite {
  readonly #sites: SiteRepository;
  readonly #ids: IdGenerator;

  constructor(sites: SiteRepository, ids: IdGenerator) {
    this.#sites = sites;
    this.#ids = ids;
  }

  async execute(
    ctx: ArchiveContext,
    input: { readonly name: string },
  ): Promise<Result<VersionedSite, ValidationFailed | AlreadyExists>> {
    const name = input.name.trim();
    const slug = slugFor(name);
    if (slug === undefined) {
      return err({
        kind: 'validation-failed',
        issues: [{ path: ['name'], message: 'must have a letter or digit' }],
      });
    }
    const site: Site = {
      id: this.#ids.newSiteId(),
      slug,
      name,
      selection: { rules: [], pinned: [], hidden: [] },
    };
    const created = await this.#sites.create(ctx, site);
    return created.ok ? ok({ site, version: created.value }) : created;
  }
}
