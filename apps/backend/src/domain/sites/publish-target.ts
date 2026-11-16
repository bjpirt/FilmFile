import type { Issue, ValidationFailed } from '../shared/domain-error.ts';
import { err, ok, type Result } from '../shared/result.ts';

/**
 * Where a site is published (D111): a Cloudflare R2 bucket, used only for
 * this site, and the address it's seen at. The keys aren't part of it; they
 * stay in the computer's `~/.aws/credentials`.
 */
export interface PublishTarget {
  readonly accountId: string;
  readonly bucket: string;
  /** Where the site is seen, only ever a link; kept as typed. */
  readonly address: string;
}

const accountIdPattern = /^[0-9a-f]{32}$/iu;
// R2's rules: 3 to 63 characters, lower-case letters, digits and hyphens,
// starting and ending with a letter or digit.
const bucketPattern = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/u;

function isHttpsAddress(address: string): boolean {
  if (address !== address.trim()) {
    return false;
  }
  try {
    const url = new URL(address);
    return (
      url.protocol === 'https:' &&
      url.hostname !== '' &&
      url.username === '' &&
      url.password === ''
    );
  } catch {
    return false;
  }
}

/** A publish target, or what's wrong with each of its fields. */
export function parsePublishTarget(input: {
  readonly accountId: string;
  readonly bucket: string;
  readonly address: string;
}): Result<PublishTarget, ValidationFailed> {
  const issues: Issue[] = [];
  if (!accountIdPattern.test(input.accountId)) {
    issues.push({
      path: ['publish', 'accountId'],
      message: 'must be 32 hexadecimal characters',
    });
  }
  if (!bucketPattern.test(input.bucket)) {
    issues.push({
      path: ['publish', 'bucket'],
      message:
        'must be 3 to 63 lower-case letters, digits or hyphens, starting and ending with a letter or digit',
    });
  }
  if (!isHttpsAddress(input.address)) {
    issues.push({
      path: ['publish', 'address'],
      message: 'must be an https:// address',
    });
  }
  if (issues.length > 0) {
    return err({ kind: 'validation-failed', issues });
  }
  return ok({
    accountId: input.accountId,
    bucket: input.bucket,
    address: input.address,
  });
}
