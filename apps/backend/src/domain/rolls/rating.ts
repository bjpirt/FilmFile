import type { ValidationFailed } from '../shared/domain-error.ts';
import { err, ok, type Result } from '../shared/result.ts';

/** A frame's rating: one to five stars. No rating is null, not zero (D39). */
export type Rating = 1 | 2 | 3 | 4 | 5;

export function isRating(value: number): value is Rating {
  return Number.isInteger(value) && value >= 1 && value <= 5;
}

export function parseRating(value: number): Result<Rating, ValidationFailed> {
  return isRating(value)
    ? ok(value)
    : err({
        kind: 'validation-failed',
        issues: [{ path: ['rating'], message: 'must be 1 to 5 stars' }],
      });
}
