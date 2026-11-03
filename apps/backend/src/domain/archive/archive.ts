import type { ArchiveId } from '../shared/ids.ts';

/** The archive itself: what it's called, and who the photographs are by. */
export interface Archive {
  readonly id: ArchiveId;
  readonly name: string;
  /** Who took the photographs, e.g. "Ben Pirt", or null. Frames inherit it. */
  readonly author: string | null;
  /** e.g. "© Ben Pirt. All rights reserved.", or null. Frames inherit it. */
  readonly copyright: string | null;
}
