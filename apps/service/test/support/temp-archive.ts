import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach } from 'vitest';

/** Gives each test an empty archive directory, removed afterwards. */
export function useTempArchive(): { readonly path: () => string } {
  let archivePath = '';

  beforeEach(async () => {
    archivePath = await mkdtemp(path.join(tmpdir(), 'filmfile-archive-'));
  });

  afterEach(async () => {
    await rm(archivePath, { recursive: true, force: true });
  });

  return { path: () => archivePath };
}
