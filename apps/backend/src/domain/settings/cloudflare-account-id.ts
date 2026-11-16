import type { ValidationFailed } from '../shared/domain-error.ts';
import { err, ok, type Result } from '../shared/result.ts';

const accountIdPattern = /^[0-9a-f]{32}$/iu;

/** A Cloudflare account ID: 32 hexadecimal characters, as its dashboard shows it (D119). */
export function parseCloudflareAccountId(
  value: string,
): Result<string, ValidationFailed> {
  return accountIdPattern.test(value)
    ? ok(value)
    : err({
        kind: 'validation-failed',
        issues: [
          {
            path: ['cloudflareAccountId'],
            message: 'must be 32 hexadecimal characters',
          },
        ],
      });
}
