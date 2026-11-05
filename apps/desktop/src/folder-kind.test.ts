import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { folderKind } from './folder-kind.ts';

let folder = '';

beforeEach(() => {
  folder = mkdtempSync(path.join(tmpdir(), 'filmfile-folder-kind-'));
});

afterEach(() => {
  rmSync(folder, { recursive: true, force: true });
});

test('knows a FilmFile folder by its Library', async () => {
  mkdirSync(path.join(folder, 'Library'));
  mkdirSync(path.join(folder, 'Exports'));

  expect(await folderKind(folder)).toBe('filmfile');
});

test('takes a Library that was never set up as a FilmFile folder', async () => {
  mkdirSync(path.join(folder, 'Library'));

  expect(await folderKind(folder)).toBe('filmfile');
});

test('knows an empty folder, with only hidden files in it', async () => {
  writeFileSync(path.join(folder, '.DS_Store'), '');

  expect(await folderKind(folder)).toBe('empty');
});

test('knows a folder with other files in it', async () => {
  writeFileSync(path.join(folder, 'holiday.jpg'), '');

  expect(await folderKind(folder)).toBe('other');
});

test('takes an archive folder, with archive.json directly in it, as another folder', async () => {
  writeFileSync(path.join(folder, 'archive.json'), '{}');
  mkdirSync(path.join(folder, 'rolls'));

  expect(await folderKind(folder)).toBe('other');
});

test('takes a Library that’s a file, not a folder, as another folder', async () => {
  writeFileSync(path.join(folder, 'Library'), '');

  expect(await folderKind(folder)).toBe('other');
});

test('knows a folder that isn’t there', async () => {
  expect(await folderKind(path.join(folder, 'unplugged'))).toBe('missing');
});
