import type {
  ArchiveId,
  FrameId,
  RollId,
  SiteId,
  VersionId,
} from '../../domain/shared/ids.ts';

/** New IDs (ULIDs). The core never makes its own, so tests can predict them. */
export interface IdGenerator {
  newArchiveId(): ArchiveId;
  newRollId(): RollId;
  newFrameId(): FrameId;
  newVersionId(): VersionId;
  newSiteId(): SiteId;
}
