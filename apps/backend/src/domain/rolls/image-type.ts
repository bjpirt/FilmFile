/**
 * The kinds of image file a version can be: web-native ones (U34), and TIFFs,
 * which raws such as a Sony ARW are too (U20).
 */
export type ImageType =
  'image/jpeg' | 'image/png' | 'image/webp' | 'image/tiff';

const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
// "RIFF" and "WEBP" in ASCII.
const riff = [0x52, 0x49, 0x46, 0x46];
const webp = [0x57, 0x45, 0x42, 0x50];
// "II" then 42, or "MM" then 42, as little- and big-endian TIFFs start.
const tiffLittle = [0x49, 0x49, 42, 0];
const tiffBig = [0x4d, 0x4d, 0, 42];

function startsWith(bytes: Uint8Array, prefix: readonly number[], at = 0) {
  return prefix.every((value, i) => bytes[at + i] === value);
}

/**
 * What kind of image a file is, from its first bytes rather than its name:
 * a JPEG's SOI marker (FF D8 FF), a PNG's eight-byte signature, a WebP's
 * "RIFF", its size, then "WEBP", or a TIFF's byte order and 42, as an ARW
 * raw has. Undefined for anything else.
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
  if (startsWith(bytes, tiffLittle) || startsWith(bytes, tiffBig)) {
    return 'image/tiff';
  }
  return undefined;
}
