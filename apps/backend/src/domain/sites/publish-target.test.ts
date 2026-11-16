import { describe, expect, test } from 'vitest';
import { parsePublishTarget } from './publish-target.ts';

const valid = {
  bucket: 'photos-pirt',
  address: 'https://photos.example.com',
};

describe('parsePublishTarget', () => {
  test('accepts a target as typed', () => {
    expect(parsePublishTarget(valid)).toEqual({ ok: true, value: valid });
  });

  test.each([
    ['a bucket with capitals', { bucket: 'Photos' }, 'bucket'],
    ['a bucket that is too short', { bucket: 'ab' }, 'bucket'],
    ['a bucket ending in a hyphen', { bucket: 'photos-' }, 'bucket'],
    ['a bucket with a slash', { bucket: 'photos/pirt' }, 'bucket'],
    ['an address that is not https', { address: 'http://a.com' }, 'address'],
    ['an address that is not a URL', { address: 'photos' }, 'address'],
    [
      'an address with spaces around it',
      { address: ' https://a.com' },
      'address',
    ],
    [
      'an address with a password',
      { address: 'https://me:secret@a.com' },
      'address',
    ],
  ])('refuses %s', (_name, change, field) => {
    expect(parsePublishTarget({ ...valid, ...change })).toMatchObject({
      ok: false,
      error: {
        kind: 'validation-failed',
        issues: [{ path: ['publish', field] }],
      },
    });
  });

  test('names every field that is wrong', () => {
    const result = parsePublishTarget({ bucket: '', address: '' });
    expect(result.ok ? [] : result.error.issues.map((i) => i.path[1])).toEqual([
      'bucket',
      'address',
    ]);
  });
});
