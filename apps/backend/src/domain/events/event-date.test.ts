import { expect, test } from 'vitest';
import { isEventDate, newestFirst, type EventDate } from './event-date.ts';

function date(value: string): EventDate {
  if (!isEventDate(value)) {
    throw new Error(`bad test data: ${value}`);
  }
  return value;
}

test.each(['2026', '2026-09', '2026-09-12', '2024-02-29'])(
  'accepts %s',
  (value) => {
    expect(isEventDate(value)).toBe(true);
  },
);

test.each(['26', '2026-13', '2026-02-30', '2026-09-12T10:00', ''])(
  'refuses %j',
  (value) => {
    expect(isEventDate(value)).toBe(false);
  },
);

test('orders events newest first by date, then by name, undated last', () => {
  const events = [
    { name: 'Undated', date: null },
    { name: 'Westfjords', date: date('2025-06') },
    { name: 'Iceland', date: date('2026-09-12') },
    { name: 'Autumn', date: date('2026') },
    { name: 'Faroe', date: date('2025-06') },
  ];

  expect([...events].sort(newestFirst).map((e) => e.name)).toEqual([
    'Iceland',
    'Autumn',
    'Faroe',
    'Westfjords',
    'Undated',
  ]);
});
