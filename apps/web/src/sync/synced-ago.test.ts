import { describe, expect, test } from 'vitest';
import { syncedAgo } from './synced-ago.ts';

const now = new Date('2026-11-17T12:00:00.000Z');
const before = (ms: number) => new Date(now.getTime() - ms).toISOString();
const minute = 60_000;
const hour = 60 * minute;
const day = 24 * hour;

describe('syncedAgo', () => {
  test.each([
    ['a few seconds', before(20_000), 'just now'],
    ['under a minute', before(minute - 1), 'just now'],
    ['a minute', before(minute), '1 min ago'],
    ['five and a half minutes', before(5.5 * minute), '5 min ago'],
    ['59 minutes', before(59 * minute + 59_000), '59 min ago'],
    ['an hour', before(hour), '1 h ago'],
    ['two and a half hours', before(2.5 * hour), '2 h ago'],
    ['23 hours', before(23 * hour + 59 * minute), '23 h ago'],
    ['a day', before(day), '1 day ago'],
    ['three days', before(3.2 * day), '3 days ago'],
    ['six days', before(6.9 * day), '6 days ago'],
    ['a week', before(7 * day), '10 Nov'],
    [
      'a time in the future, from another clock',
      before(-5 * minute),
      'just now',
    ],
  ])('%s ago reads "%s"', (_, iso, expected) => {
    expect(syncedAgo(iso, now, 'UTC')).toBe(expected);
  });

  test('a date in another year names the year', () => {
    expect(syncedAgo('2025-11-09T12:00:00.000Z', now, 'UTC')).toBe(
      '9 Nov 2025',
    );
  });

  test('the date is in the time zone given', () => {
    expect(syncedAgo('2026-11-09T23:30:00.000Z', now, 'Pacific/Auckland')).toBe(
      '10 Nov',
    );
  });
});
