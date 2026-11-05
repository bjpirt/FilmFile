import { mkdir, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { libraryName } from './read-local-config.ts';

/**
 * Checks the FilmFile folder before the service uses it (D63): a folder with
 * nothing but hidden files in it gets a `Library/` made; one with a
 * `Library/` is left as it is, even if that's never been set up; anything
 * else is refused, so a library that has moved, or whose drive isn't
 * connected, is never quietly replaced by an empty one. Nothing else is made.
 */
export async function prepareFolder(folder: string): Promise<void> {
  let names: string[];
  try {
    names = await readdir(folder);
  } catch {
    throw new Error(`FilmFile can’t find its folder, ${folder}.`);
  }
  if (await isFolder(path.join(folder, libraryName))) {
    return;
  }
  if (names.every((name) => name.startsWith('.'))) {
    await mkdir(path.join(folder, libraryName));
    return;
  }
  throw new Error(
    `${folder} isn’t a FilmFile folder: it has other files in it and no ${libraryName}. Choose your FilmFile folder, or an empty folder to start a new one.`,
  );
}

async function isFolder(candidate: string): Promise<boolean> {
  try {
    return (await stat(candidate)).isDirectory();
  } catch {
    return false;
  }
}
