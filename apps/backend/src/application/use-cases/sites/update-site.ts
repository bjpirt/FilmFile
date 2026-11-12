import type { Selection } from '../../../domain/selections/selection.ts';
import type { ArchiveContext } from '../../../domain/shared/archive-context.ts';
import type {
  AlreadyExists,
  ConcurrencyConflict,
  NotFound,
  ValidationFailed,
} from '../../../domain/shared/domain-error.ts';
import { err, ok, type Result } from '../../../domain/shared/result.ts';
import { slugFor, type Slug } from '../../../domain/shared/slug.ts';
import type { Site } from '../../../domain/sites/site.ts';
import type {
  SiteRepository,
  VersionedSite,
} from '../../ports/site-repository.ts';

/**
 * Changes a site's name or selection; a detail left out stays as it is. A new
 * name makes a new slug, and the site moves to it (what it built in `Sites/`
 * stays where it is). Saved only if the site hasn't changed since the caller
 * read it at `expectedVersion`.
 */
export class UpdateSite {
  readonly #sites: SiteRepository;

  constructor(sites: SiteRepository) {
    this.#sites = sites;
  }

  async execute(
    ctx: ArchiveContext,
    input: {
      readonly slug: Slug;
      readonly expectedVersion: string;
      readonly name?: string | undefined;
      readonly selection?: Selection | undefined;
    },
  ): Promise<
    Result<
      VersionedSite,
      NotFound | ConcurrencyConflict | ValidationFailed | AlreadyExists
    >
  > {
    const name = input.name?.trim();
    const newSlug = name === undefined ? undefined : slugFor(name);
    if (name !== undefined && newSlug === undefined) {
      return err({
        kind: 'validation-failed',
        issues: [{ path: ['name'], message: 'must have a letter or digit' }],
      });
    }
    const current = await this.#sites.get(ctx, input.slug);
    if (current === undefined) {
      return err({ kind: 'not-found', entity: 'site', id: input.slug });
    }
    const site: Site = {
      ...current.site,
      slug: newSlug ?? current.site.slug,
      ...(name === undefined ? {} : { name }),
      ...(input.selection === undefined ? {} : { selection: input.selection }),
    };
    const saved =
      site.slug === input.slug
        ? await this.#sites.save(ctx, site, input.expectedVersion)
        : await this.#sites.rename(
            ctx,
            input.slug,
            site,
            input.expectedVersion,
          );
    return saved.ok ? ok({ site, version: saved.value }) : saved;
  }
}
