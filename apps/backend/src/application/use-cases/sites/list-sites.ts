import type { ArchiveContext } from '../../../domain/shared/archive-context.ts';
import type { Slug } from '../../../domain/shared/slug.ts';
import type { SiteRepository } from '../../ports/site-repository.ts';
import type { SearchFrames } from '../selections/search-frames.ts';

/** A site in the list: its name and how many frames are on it now. */
export interface SiteListing {
  readonly slug: Slug;
  readonly name: string;
  readonly frameCount: number;
}

/** Every site by name, each with its frame count, worked out from the archive as it is. */
export class ListSites {
  readonly #sites: SiteRepository;
  readonly #search: SearchFrames;

  constructor(sites: SiteRepository, search: SearchFrames) {
    this.#sites = sites;
    this.#search = search;
  }

  async execute(ctx: ArchiveContext): Promise<readonly SiteListing[]> {
    const listed: SiteListing[] = [];
    for (const site of await this.#sites.list(ctx)) {
      const found = await this.#search.execute(ctx, {
        selection: site.selection,
      });
      listed.push({
        slug: site.slug,
        name: site.name,
        frameCount: found.filter((frame) => !frame.excluded).length,
      });
    }
    return listed;
  }
}
