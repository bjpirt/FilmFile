import type { Selection } from '../selections/selection.ts';
import type { SiteId } from '../shared/ids.ts';
import type { Slug } from '../shared/slug.ts';

/**
 * A site (D91): a name, which frames go in (a selection, D93) and, with its
 * build (FF-120), how it's presented. Always live: its frames are worked out
 * from the archive as it is. Its slug is made from its name.
 */
export interface Site {
  readonly id: SiteId;
  readonly slug: Slug;
  readonly name: string;
  readonly selection: Selection;
}
