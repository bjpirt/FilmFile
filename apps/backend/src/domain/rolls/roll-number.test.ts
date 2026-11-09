import { expect, test } from 'vitest';
import {
  compareRollNumbers,
  isRollNumber,
  parseRollNumber,
  sameRollNumber,
} from './roll-number.ts';

test.each([
  '2026-014',
  '1999-001',
  '2026-999',
  'BP/roll #1',
  'back\\slash',
  'Kodak 雪',
])('accepts %s', (value) => {
  expect(parseRollNumber(value)).toEqual({ ok: true, value });
});

test('trims surrounding whitespace and preserves the remaining label', () => {
  expect(parseRollNumber('  BP / 01  ')).toEqual({
    ok: true,
    value: 'BP / 01',
  });
});

test('compares labels without case and treats equivalent numeric suffixes as equal', () => {
  expect(sameRollNumber('BP/Scan 1', 'bp/scan 1')).toBe(true);
  expect(sameRollNumber('BP-1', 'bp-001')).toBe(true);
  expect(sameRollNumber('BP-1', 'BP-2')).toBe(false);
});

test('sorts labels naturally without regard to case', () => {
  expect(
    ['Roll 10', 'bp b', 'Roll 2', 'BP a'].sort(compareRollNumbers),
  ).toEqual(['BP a', 'bp b', 'Roll 2', 'Roll 10']);
});

test.each([
  ['nothing', ''],
  ['only whitespace', '   '],
  ['a label over 100 characters', 'x'.repeat(101)],
])('refuses %s', (_case, value) => {
  expect(parseRollNumber(value)).toEqual({
    ok: false,
    error: {
      kind: 'validation-failed',
      issues: [{ path: ['roll'], message: 'must be 1 to 100 characters' }],
    },
  });
  expect(isRollNumber(value)).toBe(false);
});
