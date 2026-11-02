// Crockford's base32, as the ULID spec requires.
const alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/**
 * A ULID: 10 characters of millisecond timestamp, then 16 random characters,
 * so IDs sort by creation time. See https://github.com/ulid/spec.
 */
export function newUlid(now: number = Date.now()): string {
  let time = '';
  let remaining = now;
  for (let i = 0; i < 10; i++) {
    time = alphabet.charAt(remaining % 32) + time;
    remaining = Math.floor(remaining / 32);
  }

  // 256 is a multiple of 32, so `byte % 32` is uniform.
  const random = Array.from(
    crypto.getRandomValues(new Uint8Array(16)),
    (byte) => alphabet.charAt(byte % 32),
  ).join('');

  return time + random;
}
