/** A file of the library as a sync sees it: its path from the FilmFile folder (`Library/…` or `settings.json`), size and SHA-256. */
export interface ManifestEntry {
  readonly path: string;
  readonly size: number;
  /** Lower-case hexadecimal. */
  readonly sha256: string;
}

/**
 * The bucket's record of the last finished sync (D117), `filmfile/sync.json`:
 * which library it backs up, how many syncs there have been, and which
 * computer made the last one, when.
 */
export interface SyncRecord {
  readonly archiveId: string;
  /** 0 when a library has claimed the bucket but not yet finished a sync. */
  readonly sync: number;
  readonly computer: string;
  /** An ISO 8601 time. */
  readonly at: string;
}
