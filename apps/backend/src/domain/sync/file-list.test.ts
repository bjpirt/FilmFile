import { expect, test } from 'vitest';
import { fileListOf } from './file-list.ts';

const file = (n: number) => ({
  path: `Library/${String(n)}.tif`,
  size: 2,
  sha256: 'a',
});

test('gives no list for no files', () => {
  expect(fileListOf([])).toBeNull();
});

test('counts the files and their size, showing the first 50 paths and how many more', () => {
  const list = fileListOf(Array.from({ length: 62 }, (_, n) => file(n)));

  expect(list).toMatchObject({ files: 62, bytes: 124, more: 12 });
  expect(list?.paths).toHaveLength(50);
  expect(list?.paths[0]).toBe('Library/0.tif');
});
