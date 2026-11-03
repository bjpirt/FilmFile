import { expect, test } from 'vitest';
import { formatShot } from './format-shot.ts';

test.each([
  ['2026', '2026'],
  ['2026-09', 'Sep 2026'],
  ['2026-09-04', '4 Sep 2026'],
  ['2026-09-14T15:30', '14 Sep 2026, 15:30'],
])('shows %s as %s', (shot, shown) => {
  expect(formatShot(shot)).toBe(shown);
});
