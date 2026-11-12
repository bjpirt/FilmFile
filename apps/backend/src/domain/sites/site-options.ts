/** What photos are split under. */
export type GroupBy = 'nothing' | 'roll' | 'event';

/** How a built site is organised: cards of its events, its rolls, or both with a menu (D104). */
export type OrganiseBy = 'events' | 'rolls' | 'both';

/** What can appear under a photo, besides its place in the lightbox. */
export type CaptionField = 'title' | 'shot' | 'camera' | 'lens' | 'film';

/** The choices a site is built with. */
export interface SiteOptions {
  /** The page's heading and title: the site's name (FF-179). */
  readonly title: string;
  readonly organiseBy: OrganiseBy;
  /** Which details a caption shows, always in the order of {@link captionOrder}. */
  readonly captions: readonly CaptionField[];
}

/** The order caption lines are written in, whatever order they were chosen in. */
export const captionOrder: readonly CaptionField[] = [
  'title',
  'shot',
  'camera',
  'lens',
  'film',
];
