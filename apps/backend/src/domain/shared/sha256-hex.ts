/**
 * The SHA-256 of some text, in hex. A pure calculation (the same text always
 * gives the same answer, and nothing is read or written), so it's here and
 * not behind a port.
 */
export async function sha256Hex(text: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(text),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}
