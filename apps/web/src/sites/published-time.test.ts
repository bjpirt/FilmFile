import { expect, test } from 'vitest';
import { publishedTime } from './published-time.ts';

test.each([
  ['2026-11-13T14:02:00.000Z', 'UTC', '13 Nov 2026, 14:02'],
  ['2026-09-05T08:07:00.000Z', 'UTC', '5 Sep 2026, 08:07'],
  // British Summer Time, an hour on.
  ['2026-07-01T23:30:00.000Z', 'Europe/London', '2 Jul 2026, 00:30'],
  ['2026-01-01T00:00:00.000Z', 'America/New_York', '31 Dec 2025, 19:00'],
])('shows %s in %s as %s', (iso, zone, shown) => {
  expect(publishedTime(iso, zone)).toBe(shown);
});
