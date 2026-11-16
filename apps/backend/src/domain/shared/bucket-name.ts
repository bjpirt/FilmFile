/** What's wrong with a bucket name, in the service's words. */
export const bucketNameMessage =
  'must be 3 to 63 lower-case letters, digits or hyphens, starting and ending with a letter or digit';

/** Whether R2 (and S3) would take a bucket name: 3 to 63 lower-case letters, digits and hyphens, starting and ending with a letter or digit. */
export function isBucketName(name: string): boolean {
  return /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/u.test(name);
}
