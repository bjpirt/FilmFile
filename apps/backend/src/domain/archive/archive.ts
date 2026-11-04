import type { ArchiveId } from '../shared/ids.ts';

/** The archive itself: who the photographs are by (D44). */
export interface Archive {
  readonly id: ArchiveId;
  /** Who took the photographs, e.g. "Ben Pirt". Frames inherit it. */
  readonly author: string;
  /** e.g. "© Ben Pirt. All rights reserved.", or null. Frames inherit it. */
  readonly copyright: string | null;
}
