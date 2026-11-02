import type { RollNumber } from '../../domain/rolls/roll-number.ts';
import type { ArchiveContext } from '../../domain/shared/archive-context.ts';
import type { FrameId, VersionId } from '../../domain/shared/ids.ts';

/** Where a new version's file goes: its roll, frame and version, and its original name. */
export interface NewBlob {
  readonly roll: RollNumber;
  readonly frameId: FrameId;
  readonly versionId: VersionId;
  readonly fileName: string;
}

/**
 * Write-once storage for image files: originals are never overwritten or
 * deleted. Files keep their original names.
 */
export interface BlobStore {
  /**
   * Stores a new version's file and returns where it is, relative to the
   * roll, for recording in the version.
   */
  put(ctx: ArchiveContext, blob: NewBlob, bytes: Uint8Array): Promise<string>;

  /** A stored file, by the roll and the path `put` returned. */
  get(ctx: ArchiveContext, roll: RollNumber, file: string): Promise<Uint8Array>;
}
