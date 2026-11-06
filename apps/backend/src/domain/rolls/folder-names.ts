import type { VersionKind } from './version-kind.ts';

// Folder IDs use the end of their ULID: the random part, short enough to read.
// Folder names are never used to find a frame or version; roll.json records
// each version's path.

export function folderName(id: string): string {
  return id.slice(-8);
}

export function frameFolderName(number: string | null, id: string): string {
  if (number === null) {
    return `unnumbered-${folderName(id)}`;
  }
  const label = number.replace(/[^A-Za-z0-9-]/gu, '_');
  return `${label.startsWith('-') ? `_${label}` : label}-${folderName(id)}`;
}

export function versionFolderName(kind: VersionKind, id: string): string {
  return `${kind}-${folderName(id)}`;
}

/** A new ID whose folder name differs from those of the given IDs. */
export function newIdWithUniqueFolder<Id extends string>(
  takenIds: readonly string[],
  generate: () => Id,
): Id {
  const taken = new Set(takenIds.map(folderName));
  let id = generate();
  while (taken.has(folderName(id))) {
    id = generate();
  }
  return id;
}
