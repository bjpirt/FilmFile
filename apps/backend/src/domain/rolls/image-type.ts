/** The kinds of image a version can be for now: web-native ones (U34). */
export type ImageType = 'image/jpeg' | 'image/png' | 'image/webp';

const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
// "RIFF" and "WEBP" in ASCII.
const riff = [0x52, 0x49, 0x46, 0x46];
const webp = [0x57, 0x45, 0x42, 0x50];

function startsWith(bytes: Uint8Array, prefix: readonly number[], at = 0) {
  return prefix.every((value, i) => bytes[at + i] === value);
}

/**
 * What kind of image a file is, from its first bytes rather than its name:
 * a JPEG's SOI marker (FF D8 FF), a PNG's eight-byte signature, or a WebP's
 * "RIFF", its size, then "WEBP". Undefined for anything else.
 */
export function imageTypeOf(bytes: Uint8Array): ImageType | undefined {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) {
    return 'image/jpeg';
  }
  if (startsWith(bytes, pngSignature)) {
    return 'image/png';
  }
  if (startsWith(bytes, riff) && startsWith(bytes, webp, 8)) {
    return 'image/webp';
  }
  return undefined;
}
