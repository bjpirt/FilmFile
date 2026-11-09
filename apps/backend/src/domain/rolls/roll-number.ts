import type { ValidationFailed } from '../shared/domain-error.ts';
import { err, ok, type Result } from '../shared/result.ts';

declare const brand: unique symbol;

/**
 * A roll's freeform label. Unlike the roll's ULID, it can change through a
 * rename.
 */
export type RollNumber = string & { readonly [brand]: 'RollNumber' };

/** The most characters a roll number can have. */
export const rollNumberMaxLength = 100;

const invalidMessage = `must be 1 to ${String(rollNumberMaxLength)} characters`;

export function isRollNumber(value: string): value is RollNumber {
  return (
    value.length > 0 &&
    value.length <= rollNumberMaxLength &&
    value === value.trim()
  );
}

export function sameRollNumber(left: string, right: string): boolean {
  return rollNumberKey(left) === rollNumberKey(right);
}

export function rollNumbersAreUnique(numbers: readonly string[]): boolean {
  const keys = new Set<string>();
  for (const number of numbers) {
    const key = rollNumberKey(number);
    if (keys.has(key)) {
      return false;
    }
    keys.add(key);
  }
  return true;
}

export function compareRollNumbers(left: string, right: string): number {
  return left.localeCompare(right, 'en', {
    sensitivity: 'base',
    numeric: true,
  });
}

function rollNumberKey(value: string): string {
  const numericSuffix = /^(.*?)(\d+)$/u.exec(value);
  if (numericSuffix === null) {
    return value.toLowerCase();
  }
  const prefix = numericSuffix[1]?.toLowerCase() ?? '';
  const suffix = numericSuffix[2]?.replace(/^0+(?=\d)/u, '') ?? '';
  return `${prefix}\0${suffix}`;
}

export function parseRollNumber(
  value: string,
): Result<RollNumber, ValidationFailed> {
  const trimmed = value.trim();
  return isRollNumber(trimmed)
    ? ok(trimmed)
    : err({
        kind: 'validation-failed',
        issues: [{ path: ['roll'], message: invalidMessage }],
      });
}
