import { expect, test } from 'vitest';
import { isRollNumber, parseRollNumber, yearOf } from './roll-number.ts';

test.each(['2026-014', '1999-001', '2026-999'])('accepts %s', (value) => {
  expect(parseRollNumber(value)).toEqual({ ok: true, value });
});

test.each([
  ['a short number', '2026-14'],
  ['a two-digit year', '26-014'],
  ['something after it', '2026-014a'],
  ['a path', '../../2026-014'],
  ['nothing', ''],
])('refuses %s', (_case, value) => {
  expect(parseRollNumber(value)).toEqual({
    ok: false,
    error: {
      kind: 'validation-failed',
      issues: [
        { path: ['roll'], message: 'must be a roll number like 2026-014' },
      ],
    },
  });
  expect(isRollNumber(value)).toBe(false);
});

test('the year is the year the roll was shot', () => {
  const parsed = parseRollNumber('2025-003');

  expect(parsed.ok && yearOf(parsed.value)).toBe('2025');
});
