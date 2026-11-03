import type { RollNumber } from '../../domain/rolls/roll-number.ts';
import type { Frame } from '../../domain/rolls/roll.ts';
import type { ArchiveContext } from '../../domain/shared/archive-context.ts';
import type { RollId } from '../../domain/shared/ids.ts';

/** A deleted frame, as the holding area keeps it: the frame and the roll it came from. */
export interface HeldFrame {
  readonly kind: 'frame';
  readonly rollId: RollId;
  readonly roll: RollNumber;
  readonly frame: Frame;
  /** When it was deleted. */
  readonly at: Date;
}

/**
 * Where deleted things go: the archive's `deleted/` folder, or memory in
 * tests. Nothing in it is ever deleted or overwritten; only the user empties
 * it (D12).
 */
export interface HoldingArea {
  /** Moves a deleted frame's files out of its roll, with its JSON, into a folder of its own. */
  holdFrame(ctx: ArchiveContext, held: Omit<HeldFrame, 'kind'>): Promise<void>;

  /** Everything held, oldest first. */
  list(ctx: ArchiveContext): Promise<readonly HeldFrame[]>;
}
