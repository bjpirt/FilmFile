import type { ManifestEntry } from './manifest.ts';

/** A file of the library as a sync reads it: what the manifest records, and its MD5, to compare with the ETag of what the bucket has (D122). */
export interface LibraryFile extends ManifestEntry {
  /** Lower-case hexadecimal. */
  readonly md5: string;
}
