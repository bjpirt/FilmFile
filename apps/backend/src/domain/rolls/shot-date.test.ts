import { expect, test } from 'vitest';
import { parseShotDate } from './shot-date.ts';

test.each(['2026', '2026-09', '2026-09-14', '2026-09-14T15:30', '2024-02-29'])(
  'accepts %s',
  (value) => {
    expect(parseShotDate(value)).toEqual({ ok: true, value });
  },
);

test.each([
  ['a two-digit year', '26'],
  ['month 13', '2026-13'],
  ['a day the month lacks', '2026-02-30'],
  ['29 February outside a leap year', '2026-02-29'],
  ['a time without a day', '2026-09T15:30'],
  ['seconds', '2026-09-14T15:30:00'],
  ['hour 24', '2026-09-14T24:00'],
  ['a time zone', '2026-09-14T15:30Z'],
  ['nothing', ''],
])('refuses %s', (_case, value) => {
  expect(parseShotDate(value)).toEqual({
    ok: false,
    error: {
      kind: 'validation-failed',
      issues: [
        {
          path: ['shot'],
          message:
            'must be a year, optionally with month, day and time, like 2026, 2026-09, 2026-09-14 or 2026-09-14T15:30',
        },
      ],
    },
  });
});
