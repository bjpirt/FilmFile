import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { prepareFolder } from './prepare-folder.ts';

let folder = '';

beforeEach(() => {
  folder = mkdtempSync(path.join(tmpdir(), 'filmfile-prepare-'));
});

afterEach(() => {
  rmSync(folder, { recursive: true, force: true });
});

test('makes a Library in an empty folder, and nothing else', async () => {
  await prepareFolder(folder);

  expect(readdirSync(folder)).toEqual(['Library']);
});

test('takes a folder with only hidden files in it as empty', async () => {
  writeFileSync(path.join(folder, '.DS_Store'), '');

  await prepareFolder(folder);

  expect(readdirSync(folder).sort()).toEqual(['.DS_Store', 'Library']);
});

test('leaves a folder that has a Library as it is', async () => {
  mkdirSync(path.join(folder, 'Library'));
  writeFileSync(path.join(folder, 'Library', 'archive.json'), '{}');
  mkdirSync(path.join(folder, 'Exports'));

  await prepareFolder(folder);

  expect(readdirSync(folder).sort()).toEqual(['Exports', 'Library']);
  expect(readdirSync(path.join(folder, 'Library'))).toEqual(['archive.json']);
});

test('takes a Library that was never set up as a FilmFile folder', async () => {
  mkdirSync(path.join(folder, 'Library'));

  await expect(prepareFolder(folder)).resolves.toBeUndefined();
});

test('refuses a folder of other files, leaving it alone', async () => {
  writeFileSync(path.join(folder, 'holiday.jpg'), '');

  await expect(prepareFolder(folder)).rejects.toThrow(
    `${folder} isn’t a FilmFile folder: it has other files in it and no Library.`,
  );
  expect(readdirSync(folder)).toEqual(['holiday.jpg']);
});

test('refuses an archive folder chosen as the FilmFile folder', async () => {
  writeFileSync(path.join(folder, 'archive.json'), '{}');
  mkdirSync(path.join(folder, 'rolls'));

  await expect(prepareFolder(folder)).rejects.toThrow(
    'isn’t a FilmFile folder',
  );
  expect(readdirSync(folder).sort()).toEqual(['archive.json', 'rolls']);
});

test('refuses a folder with Exports but no Library, as a library that has moved', async () => {
  mkdirSync(path.join(folder, 'Exports'));

  await expect(prepareFolder(folder)).rejects.toThrow('no Library');
  expect(readdirSync(folder)).toEqual(['Exports']);
});

test('refuses a folder that isn’t there, which may be on a drive that isn’t connected', async () => {
  const missing = path.join(folder, 'unplugged');

  await expect(prepareFolder(missing)).rejects.toThrow(
    `FilmFile can’t find its folder, ${missing}.`,
  );
});
