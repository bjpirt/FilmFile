import { readdir } from 'node:fs/promises';

/** What a folder chosen as the archive is (U83). */
export type FolderKind = 'archive' | 'empty' | 'other' | 'missing';

/**
 * An archive has its `archive.json`; an empty folder (hidden files such as
 * `.DS_Store` aside) can become one; anything else is someone's other files,
 * not to be set up as an archive.
 */
export async function folderKind(folder: string): Promise<FolderKind> {
  let names: string[];
  try {
    names = await readdir(folder);
  } catch {
    return 'missing';
  }
  if (names.includes('archive.json')) {
    return 'archive';
  }
  return names.every((name) => name.startsWith('.')) ? 'empty' : 'other';
}
