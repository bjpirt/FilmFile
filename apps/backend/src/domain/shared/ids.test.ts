import { describe, expect, test } from 'vitest';
import {
  isArchiveId,
  isFrameId,
  isRollId,
  isVersionId,
  parseArchiveId,
  parseFrameId,
  parseRollId,
  parseVersionId,
} from './ids.ts';

const ulid = '01M6EAAP694BKWR9HZ4N5Z54XD';

describe.each([
  ['parseArchiveId', parseArchiveId],
  ['parseRollId', parseRollId],
  ['parseFrameId', parseFrameId],
  ['parseVersionId', parseVersionId],
])('%s', (_name, parse) => {
  test('accepts a ULID', () => {
    expect(parse(ulid)).toEqual({ ok: true, value: ulid });
  });

  test.each([
    ['too short', ulid.slice(1)],
    ['lower case', ulid.toLowerCase()],
    ['a letter Crockford base 32 leaves out', `${ulid.slice(0, 25)}U`],
    ['a roll number', '2026-014'],
    ['empty', ''],
  ])('refuses one that is %s', (_case, value) => {
    expect(parse(value)).toEqual({
      ok: false,
      error: {
        kind: 'validation-failed',
        issues: [{ path: [], message: 'must be a ULID' }],
      },
    });
  });
});

test.each([
  ['isArchiveId', isArchiveId],
  ['isRollId', isRollId],
  ['isFrameId', isFrameId],
  ['isVersionId', isVersionId],
])('%s tells a ULID from anything else', (_name, isId) => {
  expect(isId(ulid)).toBe(true);
  expect(isId('2026-014')).toBe(false);
});
