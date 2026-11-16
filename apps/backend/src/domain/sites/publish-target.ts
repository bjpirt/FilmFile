import type { Issue, ValidationFailed } from '../shared/domain-error.ts';
import { bucketNameMessage, isBucketName } from '../shared/bucket-name.ts';
import { err, ok, type Result } from '../shared/result.ts';

/**
 * Where a site is published (D111): a Cloudflare R2 bucket, used only for
 * this site, and the address it's seen at. The account is set once in
 * Settings (D119), and the keys stay in the computer's `~/.aws/credentials`.
 */
export interface PublishTarget {
  readonly bucket: string;
  /** Where the site is seen, only ever a link; kept as typed. */
  readonly address: string;
}

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
  readonly bucket: string;
  readonly address: string;
}): Result<PublishTarget, ValidationFailed> {
  const issues: Issue[] = [];
  if (!isBucketName(input.bucket)) {
    issues.push({ path: ['publish', 'bucket'], message: bucketNameMessage });
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
    bucket: input.bucket,
    address: input.address,
  });
}
