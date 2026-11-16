import type { ValidationFailed } from '../shared/domain-error.ts';
import { err, ok, type Result } from '../shared/result.ts';

/** The most characters a computer's name can have. */
export const computerNameMaxLength = 60;

/** A computer's name as other computers are told it (D116), trimmed: 1 to 60 characters. */
export function parseComputerName(
  value: string,
): Result<string, ValidationFailed> {
  const name = value.trim();
  return name.length > 0 && name.length <= computerNameMaxLength
    ? ok(name)
    : err({
        kind: 'validation-failed',
        issues: [
          {
            path: ['computerName'],
            message: `must be 1 to ${String(computerNameMaxLength)} characters`,
          },
        ],
      });
}

/** This computer's name as its system gives it, with a `.local` ending taken off (it's shown to other computers). */
export function computerNameFrom(hostname: string): string {
  const name = hostname.replace(/\.local$/iu, '').trim();
  return (name === '' ? 'This computer' : name).slice(0, computerNameMaxLength);
}
