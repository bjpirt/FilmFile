import { expect, test } from 'vitest';
import { readLocalConfig } from './read-local-config.ts';

const archive = { FILMFILE_ARCHIVE: '/photos/archive' };
const mac = { platform: 'darwin', home: '/Users/ben' } as const;
const linux = { platform: 'linux', home: '/home/ben' } as const;

test('reads the archive folder from FILMFILE_ARCHIVE', () => {
  expect(readLocalConfig(archive, mac).archivePath).toBe('/photos/archive');
});

test('refuses to start without an archive folder', () => {
  expect(() => readLocalConfig({}, mac)).toThrow('Set FILMFILE_ARCHIVE');
});

test('uses port 4310 when none is set', () => {
  expect(readLocalConfig(archive, mac).port).toBe(4310);
});

test('reads the port from FILMFILE_PORT', () => {
  expect(readLocalConfig({ ...archive, FILMFILE_PORT: '5000' }, mac).port).toBe(
    5000,
  );
});

test('reads the cache folder from FILMFILE_CACHE', () => {
  expect(
    readLocalConfig({ ...archive, FILMFILE_CACHE: '/tmp/cache' }, mac)
      .cachePath,
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
  expect(readLocalConfig({ ...archive, ...env }, system).cachePath).toBe(
    expected,
  );
});
