import { describe, expect, test } from 'vitest';
import {
  manifestText,
  parseManifest,
  parseSyncRecord,
  syncRecordText,
} from './sync-files.ts';

const record = {
  archiveId: '01JC8Y0000000000000000000A',
  sync: 3,
  computer: 'Studio',
  at: '2026-11-16T14:02:00.000Z',
};
const sha = 'a'.repeat(64);

describe('sync.json', () => {
  test('reads back what it writes', () => {
    expect(parseSyncRecord(syncRecordText(record))).toEqual(record);
  });

  test.each([
    ['not JSON', 'nope'],
    ['a list', '[]'],
    ['no archive ID', JSON.stringify({ ...record, archiveId: '' })],
    ['a negative sync', JSON.stringify({ ...record, sync: -1 })],
    ['a fractional sync', JSON.stringify({ ...record, sync: 1.5 })],
    ['no time', JSON.stringify({ ...record, at: 3 })],
  ])('is not one with %s', (_name, text) => {
    expect(parseSyncRecord(text)).toBeUndefined();
  });
});

describe('manifest.json', () => {
  test('reads back what it writes', () => {
    const files = [
      { path: 'Library/a.json', size: 3, sha256: sha },
      { path: 'settings.json', size: 0, sha256: sha },
    ];

    expect(parseManifest(manifestText(files))).toEqual(files);
    expect(parseManifest(manifestText([]))).toEqual([]);
  });

  test.each([
    ['not JSON', '{'],
    ['no files', '{}'],
    [
      'a file with a bad hash',
      JSON.stringify({ files: [{ path: 'a', size: 1, sha256: 'x' }] }),
    ],
    [
      'a file with no path',
      JSON.stringify({ files: [{ path: '', size: 1, sha256: sha }] }),
    ],
  ])('is not one with %s', (_name, text) => {
    expect(parseManifest(text)).toBeUndefined();
  });
});
