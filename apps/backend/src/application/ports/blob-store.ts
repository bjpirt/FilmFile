import type { ArchiveContext } from '../../domain/shared/archive-context.ts';
import type { FrameId, RollId, VersionId } from '../../domain/shared/ids.ts';

/** Where a new version's file goes: its roll (by ID), frame and version, and its original name. */
export interface NewBlob {
  readonly rollId: RollId;
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

  /** A stored file, by the roll's ID and the path `put` returned. */
  get(ctx: ArchiveContext, rollId: RollId, file: string): Promise<Uint8Array>;
}
