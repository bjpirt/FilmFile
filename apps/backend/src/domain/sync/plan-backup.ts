import type { ManifestEntry } from './manifest.ts';

/** A renamed file, copied inside the bucket from where it already is. */
export interface BackupCopy<F extends ManifestEntry = ManifestEntry> {
  readonly from: string;
  readonly file: F;
}

/** What a backup does to the bucket. */
export interface BackupPlan<F extends ManifestEntry = ManifestEntry> {
  /** New or changed files the bucket has nowhere, by path. */
  readonly uploads: readonly F[];
  /** Files the bucket has at another path (a rename), copied there. */
  readonly copies: readonly BackupCopy<F>[];
  /** The bytes to upload; copies send none. */
  readonly bytes: number;
  /** Renamed files' old paths, removed without asking. */
  readonly renamed: readonly string[];
  /** Files gone from the library that no roll.json mentions: removed only once the person agrees (D123). */
  readonly removals: readonly ManifestEntry[];
  /** Files a roll.json mentions that are missing on this computer: never removed (D117). */
  readonly missing: readonly ManifestEntry[];
}

const byPath = (a: { readonly path: string }, b: { readonly path: string }) =>
  a.path < b.path ? -1 : a.path > b.path ? 1 : 0;

// A folder named by a label and the last 8 characters of its ULID (D66).
const idFolder = /-([0-9A-HJKMNP-TV-Z]{8})$/u;

/**
 * A path as its folders' IDs and its file's name, which renumbering a roll
 * or frame, or changing a version's kind, leaves the same (D66, D69). A path
 * with no such folders is its own.
 */
function identityOf(path: string): string {
  const names = path.split('/');
  const ids = names
    .slice(0, -1)
    .flatMap((name) => idFolder.exec(name)?.[1] ?? []);
  return ids.length === 0 ? path : `${ids.join('/')}/${names.at(-1) ?? ''}`;
}

/**
 * Compares the library with the bucket's manifest from the last sync (D117).
 * A file is copied inside the bucket when the manifest has its SHA-256 at
 * another path, and sent when the bucket has it nowhere. A path the library
 * no longer has is a rename's old path, removed without asking, when the
 * library has its SHA-256, or a file at the same IDs (a renumbered roll's
 * `roll.json`). Any other is removed once the person agrees, unless a
 * roll.json mentions it: then it's missing, and kept.
 */
export function planBackup<F extends ManifestEntry>(input: {
  readonly library: readonly F[];
  readonly manifest: readonly ManifestEntry[];
  /** The paths roll.json files mention; one ending in `/` mentions everything in that folder. */
  readonly mentioned: readonly string[];
}): BackupPlan<F> {
  const inBucket = new Map(input.manifest.map((file) => [file.path, file]));
  const pathWithHash = new Map(
    input.manifest.map((file) => [file.sha256, file.path]),
  );
  const changed = input.library
    .filter((file) => inBucket.get(file.path)?.sha256 !== file.sha256)
    .sort(byPath);
  const uploads: F[] = [];
  const copies: BackupCopy<F>[] = [];
  for (const file of changed) {
    const from = pathWithHash.get(file.sha256);
    if (from === undefined) {
      uploads.push(file);
    } else {
      copies.push({ from, file });
    }
  }

  const inLibrary = new Set(input.library.map((file) => file.path));
  const hashes = new Set(input.library.map((file) => file.sha256));
  const identities = new Set(
    input.library.map((file) => identityOf(file.path)),
  );
  const mentioned = new Set(input.mentioned);
  const folders = input.mentioned.filter((path) => path.endsWith('/'));
  const isMentioned = (path: string) =>
    mentioned.has(path) || folders.some((folder) => path.startsWith(folder));
  const gone = input.manifest
    .filter((file) => !inLibrary.has(file.path))
    .sort(byPath);
  const isRenamed = (file: ManifestEntry) =>
    hashes.has(file.sha256) || identities.has(identityOf(file.path));

  return {
    uploads,
    copies,
    bytes: uploads.reduce((total, file) => total + file.size, 0),
    renamed: gone.filter(isRenamed).map((file) => file.path),
    removals: gone.filter(
      (file) => !isRenamed(file) && !isMentioned(file.path),
    ),
    missing: gone.filter((file) => !isRenamed(file) && isMentioned(file.path)),
  };
}

/**
 * The bucket's manifest after a sync: what it had, with the files sent or
 * copied replacing those at their paths, and those removed gone. Paths the
 * library no longer has but the bucket keeps (missing, or kept for now) stay.
 */
export function manifestAfter(
  before: readonly ManifestEntry[],
  sent: readonly ManifestEntry[],
  removed: readonly string[],
): readonly ManifestEntry[] {
  const files = new Map(before.map((file) => [file.path, file]));
  for (const file of sent) {
    files.set(file.path, file);
  }
  for (const path of removed) {
    files.delete(path);
  }
  return [...files.values()].sort(byPath);
}
