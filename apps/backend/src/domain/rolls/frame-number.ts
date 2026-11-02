import type { ValidationFailed } from '../shared/domain-error.ts';
import { err, ok, type Result } from '../shared/result.ts';

declare const brand: unique symbol;

/**
 * The number printed on the film beside a frame, as free text of 1 to 9
 * characters: "23", "00", "-1", "12A", "14-15" (D19).
 */
export type FrameNumber = string & { readonly [brand]: 'FrameNumber' };

export function isFrameNumber(value: string): value is FrameNumber {
  return value.length >= 1 && value.length <= 9;
}

export function parseFrameNumber(
  value: string,
): Result<FrameNumber, ValidationFailed> {
  return isFrameNumber(value)
    ? ok(value)
    : err({
        kind: 'validation-failed',
        issues: [
          {
            path: ['number'],
            message: 'must be 1 to 9 characters, like 23 or 12A',
          },
        ],
      });
}
