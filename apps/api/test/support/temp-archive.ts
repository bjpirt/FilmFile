import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach } from 'vitest';

export interface TempArchive {
  readonly path: () => string;
  readonly cachePath: () => string;
}

/** Gives each test an empty archive folder and cache folder, removed afterwards. */
export function useTempArchive(): TempArchive {
  let archivePath = '';
  let cachePath = '';

  beforeEach(async () => {
    archivePath = await mkdtemp(path.join(tmpdir(), 'filmfile-archive-'));
    cachePath = await mkdtemp(path.join(tmpdir(), 'filmfile-cache-'));
  });

  afterEach(async () => {
    await rm(archivePath, { recursive: true, force: true });
    await rm(cachePath, { recursive: true, force: true });
  });

  return { path: () => archivePath, cachePath: () => cachePath };
}
