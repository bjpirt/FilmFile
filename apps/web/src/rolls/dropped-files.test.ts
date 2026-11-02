import { expect, test } from 'vitest';
import { droppedFiles, type DroppedEntry } from './dropped-files.ts';

function aFileEntry(name: string): DroppedEntry {
  return {
    name,
    file: (success) => {
      success(new File(['x'], name));
    },
  };
}

/** A folder whose reader hands its entries back in batches, as browsers do. */
function aFolderEntry(
  name: string,
  ...batches: DroppedEntry[][]
): DroppedEntry {
  return {
    name,
    createReader: () => {
      const remaining = [...batches, []];
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

async function namesOf(files: Promise<File[]>): Promise<string[]> {
  return (await files).map((file) => file.name);
}

test('takes dropped files as they are', async () => {
  expect(
    await namesOf(droppedFiles(aDrop(aFileEntry('12340001.jpg')))),
  ).toEqual(['12340001.jpg']);
});

test('takes the JPEGs from a dropped folder, however many batches it reads in', async () => {
  const folder = aFolderEntry(
    'lab-download',
    [aFileEntry('12340001.jpg'), aFileEntry('12340002.JPEG')],
    [aFileEntry('12340003.jpg')],
  );

  expect(await namesOf(droppedFiles(aDrop(folder)))).toEqual([
    '12340001.jpg',
    '12340002.JPEG',
    '12340003.jpg',
  ]);
});

test('ignores files in a folder that are not JPEGs, and hidden files', async () => {
  const folder = aFolderEntry('lab-download', [
    aFileEntry('12340001.jpg'),
    aFileEntry('index.txt'),
    aFileEntry('.DS_Store'),
    aFileEntry('._12340001.jpg'),
  ]);

  expect(await namesOf(droppedFiles(aDrop(folder)))).toEqual(['12340001.jpg']);
});

test('ignores folders inside a dropped folder', async () => {
  const folder = aFolderEntry('lab-download', [
    aFileEntry('12340001.jpg'),
    aFolderEntry('high-res', [aFileEntry('12340001.jpg')]),
  ]);

  expect(await namesOf(droppedFiles(aDrop(folder)))).toEqual(['12340001.jpg']);
});

test('reads a dropped folder when the drop also carries text, as Finder drags can', async () => {
  const folder = aFolderEntry('00288798', [aFileEntry('002887980001.jpg')]);
  const drop = {
    files: [new File([], '00288798')],
    items: [
      { kind: 'string', webkitGetAsEntry: () => null },
      { kind: 'file', webkitGetAsEntry: () => folder },
    ],
  };

  expect(await namesOf(droppedFiles(drop))).toEqual(['002887980001.jpg']);
});

test('takes the files list when the browser gives no entries', async () => {
  const drop = { files: [new File(['x'], '12340001.jpg')] };

  expect(await namesOf(droppedFiles(drop))).toEqual(['12340001.jpg']);
});
