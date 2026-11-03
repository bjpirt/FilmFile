import { isShotDate } from '../rolls/shot-date.ts';
import type { ValidationFailed } from '../shared/domain-error.ts';
import { err, ok, type Result } from '../shared/result.ts';

declare const brand: unique symbol;

/**
 * When an event happened, as precisely as it's known: a year, then
 * optionally month and day, e.g. `2026`, `2026-09` or `2026-09-12` (D32).
 * The same as a roll's date shot, without the time.
 */
export type EventDate = string & { readonly [brand]: 'EventDate' };

export function isEventDate(value: string): value is EventDate {
  return !value.includes('T') && isShotDate(value);
}

export function parseEventDate(
  value: string,
): Result<EventDate, ValidationFailed> {
  return isEventDate(value)
    ? ok(value)
    : err({
        kind: 'validation-failed',
        issues: [
          {
            path: ['date'],
            message:
              'must be a year, optionally with month and day, like 2026, 2026-09 or 2026-09-12',
          },
        ],
      });
}

/** The first day a date could mean: `2026-09` → `2026-09-01`. */
function earliest(date: EventDate): string {
  const [year, month = '01', day = '01'] = date.split('-');
  return `${year ?? ''}-${month}-${day}`;
}

/**
 * Orders events newest first by date, then by name; events with no date
 * come last.
 */
export function newestFirst(
  a: { readonly date: EventDate | null; readonly name: string },
  b: { readonly date: EventDate | null; readonly name: string },
): number {
  if (a.date !== b.date) {
    if (a.date === null || b.date === null) {
      return a.date === null ? 1 : -1;
    }
    const byDate = earliest(b.date).localeCompare(earliest(a.date));
    if (byDate !== 0) {
      return byDate;
    }
  }
  return a.name.localeCompare(b.name, undefined, {
    sensitivity: 'base',
    numeric: true,
  });
}
