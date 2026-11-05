import type { Slug } from '../shared/slug.ts';
import type { FrameId, RollId, VersionId } from '../shared/ids.ts';
import type { FrameNumber } from './frame-number.ts';
import type { QuarterTurn } from './quarter-turn.ts';
import type { VersionKind } from './version-kind.ts';
import type { Rating } from './rating.ts';
import type { RollNumber } from './roll-number.ts';
import type { ShotDate } from './shot-date.ts';

/** One image file of a frame: a lab scan for now. */
export interface Version {
  readonly id: VersionId;
  /** Where the file is, relative to the roll's folder. */
  readonly file: string;
  readonly sha256: string;
  readonly bytes: number;
  readonly width: number;
  readonly height: number;
  readonly added: Date;
  /** How it's turned when shown; its file is never changed (D41). */
  readonly rotate: QuarterTurn;
  /** What it is: a scan, a raw scan or a final (D48). */
  readonly kind: VersionKind;
}

/** One photograph on the roll. */
export interface Frame {
  readonly id: FrameId;
  /** The frame number printed on the film, or null if not known yet. */
  readonly number: FrameNumber | null;
  /** A title for the photograph, e.g. "Mill pond, early fog", or null. */
  readonly title: string | null;
  readonly rating: Rating | null;
  readonly notes: string | null;
  /**
   * The frame's own camera and lens, by slug, where they differ from its
   * roll's; null uses the roll's (design section 6). Its film stock is
   * always its roll's (D45).
   */
  readonly camera: Slug | null;
  readonly lens: Slug | null;
  /** The events the frame is in, by slug, in place of its roll's; null uses the roll's. */
  readonly events: readonly Slug[] | null;
  /** When the frame was shot, in place of its roll's date; null uses the roll's (D47). */
  readonly shot: ShotDate | null;
  /** The version shown for the frame; when null, its first (D15, D46). */
  readonly defaultVersion: VersionId | null;
  readonly versions: readonly Version[];
}

export interface Roll {
  readonly id: RollId;
  readonly roll: RollNumber;
  readonly filed: boolean;
  /** A name for the roll, e.g. "Iceland, first day", or null. */
  readonly name: string | null;
  /** The roll's own notes, e.g. how it was developed; its frames don't inherit them (D40). */
  readonly notes: string | null;
  /** When the roll was shot, as precisely as it's known, or null. */
  readonly shot: ShotDate | null;
  /** The event the roll was shot at (D24), or null. */
  readonly event: Slug | null;
  /** The camera the roll was shot on, or null. */
  readonly camera: Slug | null;
  /** The film stock the roll is, or null. */
  readonly film: Slug | null;
  /** The lens the roll was shot with, or null. */
  readonly lens: Slug | null;
  readonly frames: readonly Frame[];
}
