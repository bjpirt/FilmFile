import type { RollNumber } from '../../domain/rolls/roll-number.ts';
import type { Frame, Version } from '../../domain/rolls/roll.ts';
import type { ArchiveContext } from '../../domain/shared/archive-context.ts';
import type { FrameId, RollId } from '../../domain/shared/ids.ts';

/** A deleted frame, as the holding area keeps it: the frame and the roll it came from. */
export interface HeldFrame {
  readonly kind: 'frame';
  readonly rollId: RollId;
  readonly roll: RollNumber;
  readonly frame: Frame;
  /** When it was deleted. */
  readonly at: Date;
}

/** A deleted roll, as the holding area keeps it: its whole folder, frames and all (D38). */
export interface HeldRoll {
  readonly kind: 'roll';
  readonly rollId: RollId;
  readonly roll: RollNumber;
  /** When it was deleted. */
  readonly at: Date;
}

/** A deleted version of a frame (U28b), as the holding area keeps it: the version, and the frame and roll it came from. */
export interface HeldVersion {
  readonly kind: 'version';
  readonly rollId: RollId;
  readonly roll: RollNumber;
  readonly frameId: FrameId;
  readonly version: Version;
  /** When it was deleted. */
  readonly at: Date;
}

export type Held = HeldFrame | HeldRoll | HeldVersion;

/**
 * Where deleted things go: the archive's `deleted/` folder, or memory in
 * tests. Nothing in it is ever deleted or overwritten; only the user empties
 * it (D12).
 */
export interface HoldingArea {
  /** Moves a deleted frame's files out of its roll, with its JSON, into a folder of its own. */
  holdFrame(ctx: ArchiveContext, held: Omit<HeldFrame, 'kind'>): Promise<void>;

  /** Moves a deleted version's files out of its frame, with its JSON, into a folder of its own. */
  holdVersion(
    ctx: ArchiveContext,
    held: Omit<HeldVersion, 'kind'>,
  ): Promise<void>;

  /** Moves a deleted roll's whole folder, frames and all, into a folder of its own. */
  holdRoll(ctx: ArchiveContext, held: Omit<HeldRoll, 'kind'>): Promise<void>;

  /** Everything held, oldest first. */
  list(ctx: ArchiveContext): Promise<readonly Held[]>;
}
