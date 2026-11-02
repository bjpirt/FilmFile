// Frames and versions get a folder each, named by the end of their ULID: the
// random part, short enough to read, and unique within its parent folder.
// The folder name is never used to find a frame or version; roll.json records
// each version's path.

export function folderName(id: string): string {
  return id.slice(-8);
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
