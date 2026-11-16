import { createHash } from 'node:crypto';

/** The MD5 of some bytes in lower-case hexadecimal: what a bucket's ETag is for a single-part upload (not for security). */
export function md5Hex(bytes: Uint8Array): string {
  return createHash('md5').update(bytes).digest('hex');
}
