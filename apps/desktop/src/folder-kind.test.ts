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

test('knows an archive by its archive.json', async () => {
  writeFileSync(path.join(folder, 'archive.json'), '{}');
  mkdirSync(path.join(folder, 'rolls'));

  expect(await folderKind(folder)).toBe('archive');
});

test('takes a folder with only hidden files in it as empty', async () => {
  writeFileSync(path.join(folder, '.DS_Store'), '');

  expect(await folderKind(folder)).toBe('empty');
});

test('knows a folder with other things in it', async () => {
  writeFileSync(path.join(folder, 'holiday.jpg'), '');

  expect(await folderKind(folder)).toBe('other');
});

test('knows a folder that isn’t there', async () => {
  expect(await folderKind(path.join(folder, 'unplugged'))).toBe('missing');
});
