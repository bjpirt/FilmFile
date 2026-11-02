import type { FrameId, RollId, VersionId } from '../../domain/shared/ids.ts';

/** New IDs (ULIDs). The core never makes its own, so tests can predict them. */
export interface IdGenerator {
  newRollId(): RollId;
  newFrameId(): FrameId;
  newVersionId(): VersionId;
}
