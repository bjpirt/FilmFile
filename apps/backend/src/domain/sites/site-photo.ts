import type { FrameId } from '../shared/ids.ts';

/** One size of a photo, made for the site. */
export interface SiteImage {
  /** Where it is, relative to the site's folder: `images/<name>.jpg`. */
  readonly src: string;
  readonly width: number;
  /** The hash of what it was made from, kept so a later build can tell what changed. */
  readonly madeFrom: string;
}

/** A heading photos are grouped under: a roll or an event. */
export interface GroupLabel {
  /** Tells groups apart: the roll's or event's identity, not its words. */
  readonly key: string;
  readonly heading: string;
  /** A smaller line beside the heading, such as an event's date. */
  readonly detail?: string;
  /** The name of its page on a site, without `.html` (D104). */
  readonly file: string;
}

/** The words a photo's caption can be made of; each is left out when unknown. */
export interface PhotoDetails {
  readonly title?: string;
  /** The date shot, already written for reading. */
  readonly shot?: string;
  readonly camera?: string;
  readonly lens?: string;
  readonly film?: string;
}

/** A frame as the site shows it. */
export interface SitePhoto {
  readonly frame: FrameId;
  /** What a screen reader says for it, such as "Roll 2026-004, frame 12". */
  readonly alt: string;
  /** Its sizes, narrowest first; the widest is the one its frame page shows. */
  readonly images: readonly SiteImage[];
  /** The widest image's shape, so the page keeps its place as images load. */
  readonly width: number;
  readonly height: number;
  /** The name of its own page on a site, without `.html` (D105). */
  readonly file: string;
  /** Its stars, to pick a card's best photos (FF-183). */
  readonly rating: number | null;
  readonly roll: GroupLabel;
  /** Absent when the frame is in no event. */
  readonly event?: GroupLabel;
  readonly details: PhotoDetails;
}
