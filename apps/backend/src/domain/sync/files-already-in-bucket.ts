import type { LibraryFile } from './library-file.ts';

/** A file the bucket has, as its listing says. */
export interface ListedFile {
  readonly key: string;
  readonly size: number;
  /** The ETag: a single-part upload's MD5, or something else (a multi-part or encrypted upload's). */
  readonly md5: string;
}

/**
 * Splits the files a sync would upload into those still to send and those
 * the bucket already has, from a sync that didn't finish (D122): the same
 * path, size and MD5. An ETag that isn't the file's MD5 never matches, so
 * such a file is sent again rather than wrongly skipped.
 */
export function filesAlreadyInBucket(input: {
  readonly uploads: readonly LibraryFile[];
  readonly listing: readonly ListedFile[];
}): {
  readonly uploads: readonly LibraryFile[];
  readonly found: readonly LibraryFile[];
} {
  const listed = new Map(input.listing.map((file) => [file.key, file]));
  const there = (file: LibraryFile) => {
    const got = listed.get(file.path);
    return got?.size === file.size && got.md5 === file.md5;
  };
  return {
    uploads: input.uploads.filter((file) => !there(file)),
    found: input.uploads.filter(there),
  };
}
