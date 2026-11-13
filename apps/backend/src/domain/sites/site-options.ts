/** What photos are split under. */
export type GroupBy = 'nothing' | 'roll' | 'event';

/**
 * The details a frame's page can show (D105): the title and date shot under
 * the photo, the rest behind its details icon (D107). Stored as `captions`.
 */
export type CaptionField = 'title' | 'shot' | 'camera' | 'lens' | 'film';

/** The choices a site is built with. */
export interface SiteOptions {
  /** The site's title in its header and tab; blank for none (D108). */
  readonly title: string;
  /** The copyright notice at the foot of every page; blank for none (D108). */
  readonly copyright: string;
  /** Which details a frame's page shows ("Details to show"), in any order. */
  readonly captions: readonly CaptionField[];
}
