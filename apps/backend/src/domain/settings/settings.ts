import type { ArchiveId } from '../shared/ids.ts';

/**
 * What FilmFile is set up with as a whole (D65): who the photographs are by
 * (D44), and the author and copyright frames inherit. It doesn't hold the
 * FilmFile folder's own path, which the service is told when it starts (D64).
 */
export interface Settings {
  readonly id: ArchiveId;
  /** Who took the photographs, e.g. "Ben Pirt". Frames inherit it. */
  readonly author: string;
  /** e.g. "© Ben Pirt. All rights reserved.", or null. Frames inherit it. */
  readonly copyright: string | null;
  /** How roll numbers are suggested, e.g. `{year}-{n:3}` (D88). Always a valid pattern. */
  readonly rollNumberPattern: string;
}
