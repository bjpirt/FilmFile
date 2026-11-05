import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach } from 'vitest';

export interface TempArchive {
  /** The library, the FilmFile folder's `Library/`. */
  readonly path: () => string;
  /** The FilmFile folder, where `settings.json` is kept. */
  readonly folder: () => string;
  readonly cachePath: () => string;
}

/** Gives each test an empty FilmFile folder with its Library, and a cache folder, removed afterwards. */
export function useTempArchive(): TempArchive {
  let folderPath = '';
  let archivePath = '';
  let cachePath = '';

  beforeEach(async () => {
    folderPath = await mkdtemp(path.join(tmpdir(), 'filmfile-folder-'));
    archivePath = path.join(folderPath, 'Library');
    await mkdir(archivePath);
    cachePath = await mkdtemp(path.join(tmpdir(), 'filmfile-cache-'));
  });

  afterEach(async () => {
    await rm(folderPath, { recursive: true, force: true });
    await rm(cachePath, { recursive: true, force: true });
  });

  return {
    path: () => archivePath,
    folder: () => folderPath,
    cachePath: () => cachePath,
  };
}
