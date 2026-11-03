import type { ValidationFailed } from '../shared/domain-error.ts';
import { err, ok, type Result } from '../shared/result.ts';

declare const brand: unique symbol;

/**
 * When a roll was shot, as precisely as it's known: a year, then optionally
 * month, day and local time, e.g. `2026`, `2026-09`, `2026-09-14` or
 * `2026-09-14T15:30` (D27). Dates of different precision sort correctly as text.
 */
export type ShotDate = string & { readonly [brand]: 'ShotDate' };

const shape =
  /^(\d{4})(?:-(\d{2})(?:-(\d{2})(?:T([01]\d|2[0-3]):[0-5]\d)?)?)?$/;

export function isShotDate(value: string): value is ShotDate {
  const match = shape.exec(value);
  if (match === null) {
    return false;
  }
  const [, year, month, day] = match;
  if (month === undefined) {
    return true;
  }
  const monthNumber = Number(month);
  if (monthNumber < 1 || monthNumber > 12) {
    return false;
  }
  if (day === undefined) {
    return true;
  }
  // Day 0 of the next month is the last day of this one.
  const daysInMonth = new Date(
    Date.UTC(Number(year), monthNumber, 0),
  ).getUTCDate();
  return Number(day) >= 1 && Number(day) <= daysInMonth;
}

export function parseShotDate(
  value: string,
): Result<ShotDate, ValidationFailed> {
  return isShotDate(value)
    ? ok(value)
    : err({
        kind: 'validation-failed',
        issues: [
          {
            path: ['shot'],
            message:
              'must be a year, optionally with month, day and time, like 2026, 2026-09, 2026-09-14 or 2026-09-14T15:30',
          },
        ],
      });
}
