import type { ValidationFailed } from '../../../domain/shared/domain-error.ts';
import { err, ok, type Result } from '../../../domain/shared/result.ts';

/** The archive's author, trimmed; it can't be blank (D44). */
export function archiveAuthor(
  author: string,
): Result<string, ValidationFailed> {
  const trimmed = author.trim();
  return trimmed === ''
    ? err({
        kind: 'validation-failed',
        issues: [{ path: ['author'], message: 'must not be blank' }],
      })
    : ok(trimmed);
}
