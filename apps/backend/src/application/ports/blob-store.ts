import type { FrameNumber } from '../../domain/rolls/frame-number.ts';
import type { VersionKind } from '../../domain/rolls/version-kind.ts';
import type { ArchiveContext } from '../../domain/shared/archive-context.ts';
import type { FrameId, RollId, VersionId } from '../../domain/shared/ids.ts';

/** Where a new version's file goes: its roll (by ID), frame and version, and its original name. */
export interface NewBlob {
  readonly rollId: RollId;
  readonly frameId: FrameId;
  readonly frameNumber: FrameNumber | null;
  readonly versionId: VersionId;
  readonly kind: VersionKind;
  readonly fileName: string;
}

/** What making a stored file read-only did. */
export type ReadOnlyResult =
  /** It was writable and now isn't. */
  | 'changed'
  /** It already wasn't writable. */
  | 'already'
  /** There's no such file. */
  | 'missing'
  /** Its permissions couldn't be changed (a drive or share that doesn't keep them). */
  | 'failed';

/**
 * Write-once storage for image files: originals are never overwritten or
 * deleted, and are made read-only as they're stored (D96). Files keep their
 * original names.
 */
export interface BlobStore {
  /**
   * Stores a new version's file and returns where it is, relative to the
   * roll, for recording in the version.
   */
  put(ctx: ArchiveContext, blob: NewBlob, bytes: Uint8Array): Promise<string>;

  /** A stored file, by the roll's ID and the path `put` returned. */
  get(ctx: ArchiveContext, rollId: RollId, file: string): Promise<Uint8Array>;

  /**
   * Removes the write permission from a stored file, keeping its others, for
   * files stored before `put` did it (FF-109). Never throws for a file it
   * can't change: it says so.
   */
  makeReadOnly(
    ctx: ArchiveContext,
    rollId: RollId,
    file: string,
  ): Promise<ReadOnlyResult>;
}
