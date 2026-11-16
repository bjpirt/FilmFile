import { createHash } from 'node:crypto';
import {
  mkdir,
  mkdtemp,
  readdir,
  rm,
  utimes,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { FilesystemLibraryFiles } from '../../src/adapters/outbound/filesystem/filesystem-library-files.ts';
import { InMemoryLibraryFiles } from '../../src/adapters/outbound/memory/in-memory-library-files.ts';
import { libraryFilesContract } from './library-files-contract.ts';

const folders: string[] = [];

afterEach(async () => {
  await Promise.all(
    folders.splice(0).map((folder) => rm(folder, { recursive: true })),
  );
});

async function aFolder(): Promise<{ folder: string; cache: string }> {
  const folder = await mkdtemp(path.join(tmpdir(), 'filmfile-sync-'));
  const cache = await mkdtemp(path.join(tmpdir(), 'filmfile-sync-cache-'));
  folders.push(folder, cache);
  await mkdir(path.join(folder, 'Library'));
  return { folder, cache };
}

async function putIn(folder: string, relative: string, text: string) {
  const file = path.join(folder, ...relative.split('/'));
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, text);
}

libraryFilesContract('InMemoryLibraryFiles', () => {
  const files = new InMemoryLibraryFiles();
  return Promise.resolve({
    files,
    put: (relative, text) => {
      files.files.set(relative, new TextEncoder().encode(text));
      return Promise.resolve();
    },
  });
});

libraryFilesContract('FilesystemLibraryFiles', async () => {
  const { folder, cache } = await aFolder();
  return {
    files: new FilesystemLibraryFiles(folder, cache),
    put: (relative, text) => putIn(folder, relative, text),
  };
});

test('FilesystemLibraryFiles keeps its hashes in the cache folder, never the FilmFile folder, and reads a file again only when its size or time changes', async () => {
  const { folder, cache } = await aFolder();
  const file = path.join(folder, 'Library', 'a.json');
  const at = new Date('2026-11-16T14:02:00.000Z');
  await putIn(folder, 'Library/a.json', 'one');
  await utimes(file, at, at);
  const files = new FilesystemLibraryFiles(folder, cache);
  await files.describe();

  // Same size and time, other bytes: the cached hash stands.
  await writeFile(file, 'two');
  await utimes(file, at, at);
  const [cached] = await files.describe();
  // A new time: read again.
  await utimes(file, at, new Date('2026-11-16T15:00:00.000Z'));
  const [readAgain] = await files.describe();

  expect(cached?.sha256).toBe(createHash('sha256').update('one').digest('hex'));
  expect(readAgain?.sha256).toBe(
    createHash('sha256').update('two').digest('hex'),
  );
  expect(await readdir(cache)).toEqual(['sync-hashes.json']);
  expect(await readdir(folder)).toEqual(['Library']);
});
