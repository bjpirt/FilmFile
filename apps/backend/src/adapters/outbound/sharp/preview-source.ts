import { imageTypeOf } from '../../../domain/rolls/image-type.ts';
import { readTiffStructure, type EmbeddedJpeg } from './tiff-structure.ts';

/**
 * What a thumbnail or an export is made from: a raw's largest preview JPEG where it
 * carries one, since sharp can't develop a raw (U20); otherwise the file
 * itself, a plain TIFF included.
 */
export function previewSource(file: Uint8Array): Uint8Array {
  if (imageTypeOf(file) !== 'image/tiff') {
    return file;
  }
  const largest = readTiffStructure(file)?.previews.reduce<
    EmbeddedJpeg | undefined
  >(
    (best, preview) =>
      best === undefined || preview.length > best.length ? preview : best,
    undefined,
  );
  return largest === undefined
    ? file
    : file.subarray(largest.offset, largest.offset + largest.length);
}
