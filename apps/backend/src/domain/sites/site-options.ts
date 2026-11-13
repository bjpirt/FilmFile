/** What photos are split under. */
export type GroupBy = 'nothing' | 'roll' | 'event';

/**
 * The details a frame's page can show (D105): the title and date shot under
 * the photo, the rest behind its details icon (D107). Stored as `captions`.
 */
export type CaptionField = 'title' | 'shot' | 'camera' | 'lens' | 'film';

/** The choices a site is built with. */
export interface SiteOptions {
  /** The page's heading and title: the site's name (FF-179). */
  readonly title: string;
  /** Which details a frame's page shows ("Details to show"), in any order. */
  readonly captions: readonly CaptionField[];
}
