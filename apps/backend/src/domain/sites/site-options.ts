/** What photos are split under. */
export type GroupBy = 'nothing' | 'roll' | 'event';

/** What can appear in a photo's caption, on its frame page (D105). */
export type CaptionField = 'title' | 'shot' | 'camera' | 'lens' | 'film';

/** The choices a site is built with. */
export interface SiteOptions {
  /** The page's heading and title: the site's name (FF-179). */
  readonly title: string;
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
