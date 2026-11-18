import type { ListedFile } from './files-already-in-bucket.ts';

/** How much of the whole library is in the bucket: a first sync's progress (FF-241). */
export interface BackupFigure {
  readonly bytes: number;
  readonly files: number;
  readonly bytesBackedUp: number;
  readonly filesBackedUp: number;
}

/**
 * How far a first sync that didn't finish got, from the bucket's listing:
 * the library's files that are there at the same path and size. Nothing is
 * hashed, so it's a guide; a sync still checks MD5s before skipping (D122).
 */
export function firstSyncFigure(input: {
  readonly library: readonly { readonly path: string; readonly size: number }[];
  readonly listing: readonly ListedFile[];
}): BackupFigure {
  const listed = new Map(input.listing.map((file) => [file.key, file.size]));
  const there = input.library.filter(
    (file) => listed.get(file.path) === file.size,
  );
  const sum = (files: readonly { readonly size: number }[]) =>
    files.reduce((total, file) => total + file.size, 0);
  return {
    bytes: sum(input.library),
    files: input.library.length,
    bytesBackedUp: sum(there),
    filesBackedUp: there.length,
  };
}
