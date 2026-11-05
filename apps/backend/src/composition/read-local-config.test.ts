import { expect, test } from 'vitest';
import { readLocalConfig } from './read-local-config.ts';

const folder = { FILMFILE_FOLDER: '/photos/FilmFile' };
const mac = { platform: 'darwin', home: '/Users/ben' } as const;
const linux = { platform: 'linux', home: '/home/ben' } as const;

test('reads the FilmFile folder from FILMFILE_FOLDER, and keeps the library in its Library folder', () => {
  const config = readLocalConfig(folder, mac);

  expect(config.folderPath).toBe('/photos/FilmFile');
  expect(config.archivePath).toBe('/photos/FilmFile/Library');
});

test('refuses to start without a FilmFile folder', () => {
  expect(() => readLocalConfig({}, mac)).toThrow(
    'Set FILMFILE_FOLDER to your FilmFile folder.',
  );
  expect(() => readLocalConfig({ FILMFILE_FOLDER: '' }, mac)).toThrow(
    'Set FILMFILE_FOLDER',
  );
});

test('no longer reads FILMFILE_ARCHIVE', () => {
  expect(() =>
    readLocalConfig({ FILMFILE_ARCHIVE: '/photos/archive' }, mac),
  ).toThrow('Set FILMFILE_FOLDER');
});

test('refuses a FilmFile folder that isn’t an absolute path', () => {
  expect(() => readLocalConfig({ FILMFILE_FOLDER: 'FilmFile' }, mac)).toThrow(
    'FILMFILE_FOLDER must be an absolute path',
  );
});

test('uses port 4310 when none is set', () => {
  expect(readLocalConfig(folder, mac).port).toBe(4310);
});

test('reads the port from FILMFILE_PORT', () => {
  expect(readLocalConfig({ ...folder, FILMFILE_PORT: '5000' }, mac).port).toBe(
    5000,
  );
});

test('serves the UI built in apps/web/dist', () => {
  expect(readLocalConfig(folder, mac).uiPath).toMatch(/apps\/web\/dist$/);
});

test('reads where the built UI is from FILMFILE_UI, as the packaged app has it elsewhere', () => {
  expect(
    readLocalConfig(
      { ...folder, FILMFILE_UI: '/Applications/FilmFile.app/web' },
      mac,
    ).uiPath,
  ).toBe('/Applications/FilmFile.app/web');
});

test('reads the origin of a separately served UI from FILMFILE_UI_ORIGIN', () => {
  expect(
    readLocalConfig(
      { ...folder, FILMFILE_UI_ORIGIN: 'http://localhost:5173' },
      mac,
    ).uiOrigin,
  ).toBe('http://localhost:5173');
});

test('reads the cache folder from FILMFILE_CACHE', () => {
  expect(
    readLocalConfig({ ...folder, FILMFILE_CACHE: '/tmp/cache' }, mac).cachePath,
  ).toBe('/tmp/cache');
});

test.each([
  ['macOS', {}, mac, '/Users/ben/Library/Caches/FilmFile'],
  ['Linux', {}, linux, '/home/ben/.cache/filmfile'],
  [
    'Linux with XDG_CACHE_HOME',
    { XDG_CACHE_HOME: '/home/ben/cache' },
    linux,
    '/home/ben/cache/filmfile',
  ],
])('uses the OS cache folder on %s', (_name, env, system, expected) => {
  expect(readLocalConfig({ ...folder, ...env }, system).cachePath).toBe(
    expected,
  );
});
