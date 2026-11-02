import type { FrameId, RollId, VersionId } from '../shared/ids.ts';
import type { FrameNumber } from './frame-number.ts';
import type { RollNumber } from './roll-number.ts';

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
}

/** One photograph on the roll. */
export interface Frame {
  readonly id: FrameId;
  /** The frame number printed on the film, or null if not known yet. */
  readonly number: FrameNumber | null;
  readonly versions: readonly Version[];
}

export interface Roll {
  readonly id: RollId;
  readonly roll: RollNumber;
  readonly frames: readonly Frame[];
}
