import type { Slug } from '../../../domain/shared/slug.ts';

/**
 * What each site is being published or unpublished (FF-201), so a build,
 * which would swap the folder being uploaded, is refused until it's done.
 * Shared by the builds and publishing of sites.
 */
export class SiteWork {
  readonly #doing = new Map<Slug, 'publishing' | 'unpublishing'>();

  doing(slug: Slug): 'publishing' | 'unpublishing' | undefined {
    return this.#doing.get(slug);
  }

  begin(slug: Slug, what: 'publishing' | 'unpublishing'): void {
    this.#doing.set(slug, what);
  }

  end(slug: Slug): void {
    this.#doing.delete(slug);
  }
}
