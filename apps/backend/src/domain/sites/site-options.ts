/** What a site's photos are split under. */
export type GroupBy = 'nothing' | 'roll' | 'event';

/** What can appear under a photo, besides its place in the lightbox. */
export type CaptionField = 'title' | 'shot' | 'camera' | 'lens' | 'film';

/** The choices a site is built with. */
export interface SiteOptions {
  /** The page's heading and title. */
  readonly title: string;
  /** Text under the heading; a blank line starts a new paragraph. */
  readonly intro: string;
  readonly groupBy: GroupBy;
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
