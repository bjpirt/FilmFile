import { expect, test } from 'vitest';
import { readLocalConfig } from './read-local-config.ts';

const archive = { FILMFILE_ARCHIVE: '/photos/archive' };

test('reads the archive folder from FILMFILE_ARCHIVE', () => {
  expect(readLocalConfig(archive).archivePath).toBe('/photos/archive');
});

test('refuses to start without an archive folder', () => {
  expect(() => readLocalConfig({})).toThrow('Set FILMFILE_ARCHIVE');
});

test('uses port 4310 when none is set', () => {
  expect(readLocalConfig(archive).port).toBe(4310);
});

test('reads the port from FILMFILE_PORT', () => {
  expect(readLocalConfig({ ...archive, FILMFILE_PORT: '5000' }).port).toBe(
    5000,
  );
});
