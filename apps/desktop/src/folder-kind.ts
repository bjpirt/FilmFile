import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';

/** What a folder chosen as the FilmFile folder is (FF-105). */
export type FolderKind = 'filmfile' | 'empty' | 'other' | 'missing';

/**
 * A FilmFile folder has a `Library/`, even one never set up; an empty folder
 * (hidden files such as `.DS_Store` aside) can become one; anything else,
 * including an archive folder chosen directly, is someone's other files, not
 * to be set up (D63). The same rule the service applies on starting, here to
 * show friendly dialogs first.
 */
export async function folderKind(folder: string): Promise<FolderKind> {
  let names: string[];
  try {
    names = await readdir(folder);
  } catch {
    return 'missing';
  }
  if (await isFolder(path.join(folder, 'Library'))) {
    return 'filmfile';
  }
  return names.every((name) => name.startsWith('.')) ? 'empty' : 'other';
}

async function isFolder(candidate: string): Promise<boolean> {
  try {
    return (await stat(candidate)).isDirectory();
  } catch {
    return false;
  }
}
