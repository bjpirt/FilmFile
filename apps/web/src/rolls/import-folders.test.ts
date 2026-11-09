import { describe, expect, test } from 'vitest';
import type { DroppedEntry } from './dropped-files.ts';
import { foldersFromDrop, foldersFromPicker } from './import-folders.ts';

function aFile(path: string): File {
  const file = new File(['x'], path.split('/').at(-1) ?? path);
  Object.defineProperty(file, 'webkitRelativePath', { value: path });
  return file;
}

function aFileEntry(name: string): DroppedEntry {
  return {
    name,
    file: (success) => {
      success(new File(['x'], name));
    },
  };
}

function aFolderEntry(name: string, ...entries: DroppedEntry[]): DroppedEntry {
  return {
    name,
    createReader: () => {
      const remaining = [entries, []];
      return {
        readEntries: (success) => {
          success(remaining.shift() ?? []);
        },
      };
    },
  };
}

function aDrop(...entries: DroppedEntry[]) {
  return {
    files: [],
    items: entries.map((entry) => ({
      kind: 'file',
      webkitGetAsEntry: () => entry,
    })),
  };
}

describe('the roll folders in what is chosen', () => {
  test('are the subfolders with JPEGs of a folder dropped, in natural name order, skipping those without', async () => {
    const found = await foldersFromDrop(
      aDrop(
        aFolderEntry(
          'lab',
          aFolderEntry('roll 10', aFileEntry('a.jpg')),
          aFolderEntry(
            'roll 2',
            aFileEntry('12340002.jpg'),
            aFileEntry('12340001.JPEG'),
            aFileEntry('._12340001.jpg'),
            aFileEntry('notes.txt'),
          ),
          aFolderEntry('thumbs', aFileEntry('index.html')),
          aFolderEntry('roll 3', aFolderEntry('deeper', aFileEntry('x.jpg'))),
        ),
      ),
    );

    expect(found.folders.map((f) => [f.name, f.scans.length])).toEqual([
      ['roll 2', 2],
      ['roll 10', 1],
    ]);
    expect(found.skipped).toEqual(['roll 3', 'thumbs']);
  });

  test('are several folders dropped together, each a roll', async () => {
    const found = await foldersFromDrop(
      aDrop(
        aFolderEntry('roll B', aFileEntry('2.jpg'), aFileEntry('3.jpg')),
        aFolderEntry('roll A', aFileEntry('1.jpg')),
        aFileEntry('stray.jpg'),
        aFolderEntry('empty'),
      ),
    );

    expect(found.folders.map((f) => [f.name, f.scans.length])).toEqual([
      ['roll A', 1],
      ['roll B', 2],
    ]);
    expect(found.skipped).toEqual(['empty']);
  });

  test('are none when only files are dropped', async () => {
    const found = await foldersFromDrop(aDrop(aFileEntry('12340001.jpg')));

    expect(found).toEqual({ folders: [], skipped: [] });
  });

  test('come from the paths of the files a folder picker gives', () => {
    const found = foldersFromPicker([
      aFile('lab/roll B/2.jpg'),
      aFile('lab/roll B/1.jpg'),
      aFile('lab/roll A/1.jpeg'),
      aFile('lab/roll A/.DS_Store'),
      aFile('lab/thumbs/index.html'),
      aFile('lab/roll C/deeper/1.jpg'),
    ]);

    expect(found.folders.map((f) => [f.name, f.scans.length])).toEqual([
      ['roll A', 1],
      ['roll B', 2],
    ]);
    expect(found.skipped).toEqual(['thumbs']);
  });

  test('make the folder itself a roll when it holds JPEGs of its own', () => {
    const found = foldersFromPicker([
      aFile('roll/12340001.jpg'),
      aFile('roll/12340002.jpg'),
    ]);

    expect(found.folders.map((f) => [f.name, f.scans.length])).toEqual([
      ['roll', 2],
    ]);
    expect(found.skipped).toEqual([]);
  });
});
