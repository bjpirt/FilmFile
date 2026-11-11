import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from 'vitest';
import { FilesystemExportFolder } from '../../src/adapters/outbound/filesystem/filesystem-export-folder.ts';
import { InMemoryExportFolder } from '../../src/adapters/outbound/memory/in-memory-export-destination.ts';
import { useTempArchive } from '../support/temp-archive.ts';
import { exportFolderContract } from './export-folder-contract.ts';

const archive = useTempArchive();

exportFolderContract('InMemoryExportFolder', () => {
  const folder = new InMemoryExportFolder();
  return {
    folder,
    read: (file) => {
      const found = folder.files.get(file);
      return Promise.resolve(
        found === undefined ? undefined : new TextDecoder().decode(found),
      );
    },
  };
});

exportFolderContract('FilesystemExportFolder', () => {
  const root = path.join(archive.folder(), 'chosen');
  return {
    folder: new FilesystemExportFolder(root),
    read: async (file) => {
      try {
        return await readFile(path.join(root, file), 'utf8');
      } catch {
        return undefined;
      }
    },
  };
});

test('FilesystemExportFolder leaves no temporary file behind', async () => {
  const root = path.join(archive.folder(), 'chosen');
  const folder = new FilesystemExportFolder(root);

  await folder.write('a.jpg', new Uint8Array([1]));
  await folder.write('a.jpg', new Uint8Array([2]));

  expect((await readdir(root)).sort()).toEqual(['a-2.jpg', 'a.jpg']);
});
