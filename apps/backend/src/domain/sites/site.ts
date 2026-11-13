import type { Selection } from '../selections/selection.ts';
import type { SiteId } from '../shared/ids.ts';
import type { Slug } from '../shared/slug.ts';
import type { CaptionField } from './site-options.ts';

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
  readonly presentation: SitePresentation;
}

/**
 * How a site is shown when it's built (FF-120), always organised by event
 * (D107): its title and copyright notice (D108) and the details its frame
 * pages show.
 */
export interface SitePresentation {
  /** The title its pages show, apart from its name; blank for none (D108). */
  readonly title: string;
  /** Its copyright notice; null takes the archive's from Settings, blank shows none (D108). */
  readonly copyright: string | null;
  /** Which details a caption shows. */
  readonly captions: readonly CaptionField[];
}

/** A site shown plainly: no title, the archive's copyright, each photo's title. */
export const defaultPresentation: SitePresentation = {
  title: '',
  copyright: null,
  captions: ['title'],
};
