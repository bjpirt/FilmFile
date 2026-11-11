import { expect, test } from 'vitest';
import { shotLabel } from './shot-label.ts';

test.each([
  ['2026', '2026'],
  ['2026-09', 'Sep 2026'],
  ['2026-09-04', '4 Sep 2026'],
  ['2026-09-14T15:30', '14 Sep 2026'],
])('writes %s as %s', (date, label) => {
  expect(shotLabel(date)).toBe(label);
});
