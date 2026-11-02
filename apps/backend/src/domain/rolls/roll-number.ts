import type { ValidationFailed } from '../shared/domain-error.ts';
import { err, ok, type Result } from '../shared/result.ts';

declare const brand: unique symbol;

/**
 * A roll's label, `YYYY-NNN`, as written on its sleeve: the year it was shot
 * and the next free number that year. Unlike the roll's ULID, it can change
 * through a rename.
 */
export type RollNumber = string & { readonly [brand]: 'RollNumber' };

export function isRollNumber(value: string): value is RollNumber {
  return /^\d{4}-\d{3}$/.test(value);
}

export function parseRollNumber(
  value: string,
): Result<RollNumber, ValidationFailed> {
  return isRollNumber(value)
    ? ok(value)
    : err({
        kind: 'validation-failed',
        issues: [
          { path: ['roll'], message: 'must be a roll number like 2026-014' },
        ],
      });
}

/** The year the roll was shot, e.g. `2026`. */
export function yearOf(rollNumber: RollNumber): string {
  return rollNumber.slice(0, 4);
}
