import type { ValidationFailed } from '../../../domain/shared/domain-error.ts';
import { err, ok, type Result } from '../../../domain/shared/result.ts';

/** An archive's name, trimmed; it can't be blank. */
export function archiveName(name: string): Result<string, ValidationFailed> {
  const trimmed = name.trim();
  return trimmed === ''
    ? err({
        kind: 'validation-failed',
        issues: [{ path: ['name'], message: 'must not be blank' }],
      })
    : ok(trimmed);
}
