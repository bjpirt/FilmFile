import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';
import {
  readSettings,
  saveSettings,
  updateSettings,
} from './desktop-settings.ts';

let folder = '';
let file = '';

beforeEach(() => {
  folder = mkdtempSync(path.join(tmpdir(), 'filmfile-settings-'));
  file = path.join(folder, 'settings.json');
});

afterEach(() => {
  rmSync(folder, { recursive: true, force: true });
});

test('has no folder before one is chosen', async () => {
  expect(await readSettings(file)).toEqual({});
});

test('remembers the FilmFile folder chosen', async () => {
  await saveSettings(file, { folder: '/Volumes/Photos/FilmFile' });

  expect(await readSettings(file)).toEqual({
    folder: '/Volumes/Photos/FilmFile',
  });
  expect(readFileSync(file, 'utf8')).toBe(
    '{\n  "folder": "/Volumes/Photos/FilmFile"\n}\n',
  );
});

test('ignores the archive an earlier version remembered', async () => {
  writeFileSync(file, '{ "archive": "/Volumes/Photos/archive" }');

  expect(await readSettings(file)).toEqual({});
});

test('starts afresh from settings it can’t read', async () => {
  writeFileSync(file, '{ "folder": 12 ');

  expect(await readSettings(file)).toEqual({});
});

test('remembers the folder downloads were last saved to, beside the FilmFile folder', async () => {
  await saveSettings(file, { folder: '/Volumes/Photos/FilmFile' });

  await updateSettings(file, { downloadFolder: '/Users/ben/Pictures/Iceland' });
  await updateSettings(file, { exportFolder: '/Volumes/Prints' });
  await updateSettings(file, { folder: '/Volumes/Other/FilmFile' });

  expect(await readSettings(file)).toEqual({
    folder: '/Volumes/Other/FilmFile',
    downloadFolder: '/Users/ben/Pictures/Iceland',
    exportFolder: '/Volumes/Prints',
  });
});
