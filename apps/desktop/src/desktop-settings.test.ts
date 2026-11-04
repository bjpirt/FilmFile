import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { readSettings, saveSettings } from './desktop-settings.ts';

let folder = '';
let file = '';

beforeEach(() => {
  folder = mkdtempSync(path.join(tmpdir(), 'filmfile-settings-'));
  file = path.join(folder, 'settings.json');
});

afterEach(() => {
  rmSync(folder, { recursive: true, force: true });
});

test('has no archive before one is chosen', async () => {
  expect(await readSettings(file)).toEqual({});
});

test('remembers the archive chosen', async () => {
  await saveSettings(file, { archive: '/Volumes/Photos/FilmFile' });

  expect(await readSettings(file)).toEqual({
    archive: '/Volumes/Photos/FilmFile',
  });
  expect(readFileSync(file, 'utf8')).toBe(
    '{\n  "archive": "/Volumes/Photos/FilmFile"\n}\n',
  );
});

test('starts afresh from settings it can’t read', async () => {
  writeFileSync(file, '{ "archive": 12 ');

  expect(await readSettings(file)).toEqual({});
});
