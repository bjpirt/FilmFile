import type { ManifestEntry } from './manifest.ts';

/** What a backup sends, and how much. */
export interface BackupPlan<F extends ManifestEntry = ManifestEntry> {
  /** New or changed files, by path. */
  readonly uploads: readonly F[];
  readonly bytes: number;
}

/**
 * Compares the library with the bucket's manifest from the last sync (D117):
 * a file is sent when the bucket has nothing at its path, or something with
 * another SHA-256. Nothing is removed here (FF-238).
 */
export function planBackup<F extends ManifestEntry>(input: {
  readonly library: readonly F[];
  readonly manifest: readonly ManifestEntry[];
}): BackupPlan<F> {
  const inBucket = new Map(input.manifest.map((file) => [file.path, file]));
  const uploads = input.library
    .filter((file) => inBucket.get(file.path)?.sha256 !== file.sha256)
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return {
    uploads,
    bytes: uploads.reduce((total, file) => total + file.size, 0),
  };
}

/**
 * The bucket's manifest after a sync: what it had, with the files sent
 * replacing those at their paths. Paths the library no longer has stay,
 * since their files are still in the bucket (FF-238 removes them).
 */
export function manifestAfter(
  before: readonly ManifestEntry[],
  sent: readonly ManifestEntry[],
): readonly ManifestEntry[] {
  const byPath = new Map(before.map((file) => [file.path, file]));
  for (const file of sent) {
    byPath.set(file.path, file);
  }
  return [...byPath.values()].sort((a, b) =>
    a.path < b.path ? -1 : a.path > b.path ? 1 : 0,
  );
}
