import { expect, test } from 'vitest';
import { nextRollNumber } from './next-roll-number.ts';

// The same cases as the service's copy of this rule (apps/backend/src/domain/rolls/next-roll-number.test.ts).

test('starts a year with no rolls at 001', () => {
  expect(nextRollNumber('2026', [])).toBe('2026-001');
});

test('is one more than the highest number of the year', () => {
  expect(nextRollNumber('2026', ['2026-014', '2026-003'])).toBe('2026-015');
});

test('doesn’t reuse a gap left by a roll that was deleted', () => {
  expect(nextRollNumber('2026', ['2026-001', '2026-005'])).toBe('2026-006');
});

test('looks only at the year asked for', () => {
  expect(nextRollNumber('2026', ['2025-031', '2027-002'])).toBe('2026-001');
  expect(nextRollNumber('2025', ['2025-031', '2027-002'])).toBe('2025-032');
});

test('counts the number a folder is named for, with or without an ID after it', () => {
  expect(nextRollNumber('2026', ['2026-020-Q2P7RM4K', '2026-018'])).toBe(
    '2026-021',
  );
});

test('ignores names that aren’t a roll number', () => {
  expect(nextRollNumber('2026', ['notes', '2026-xyz', '2026-7', ''])).toBe(
    '2026-001',
  );
});

test('has 999 numbers a year: the last is given, then none is left', () => {
  expect(nextRollNumber('2026', ['2026-998'])).toBe('2026-999');
  expect(nextRollNumber('2026', ['2026-999'])).toBeUndefined();
});
