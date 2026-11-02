import type { ArchiveId } from './ids.ts';

/** Which archive a use case acts on. Every use case takes one. */
export interface ArchiveContext {
  readonly archiveId: ArchiveId;
}
