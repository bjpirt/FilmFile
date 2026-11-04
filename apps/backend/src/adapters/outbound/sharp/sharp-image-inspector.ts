import { createHash } from 'node:crypto';
import sharp from 'sharp';
import type {
  ImageFacts,
  ImageInspector,
} from '../../../application/ports/image-inspector.ts';
import type { ImageRejected } from '../../../domain/shared/domain-error.ts';
import { imageTypeOf } from '../../../domain/rolls/image-type.ts';
import { err, ok, type Result } from '../../../domain/shared/result.ts';
import { readTiffStructure } from './tiff-structure.ts';

/**
 * An image's size: a TIFF's, a raw's included, from its tables (its largest
 * image, a raw's sensor), others' from sharp reading the header.
 */
async function sizeOf(
  bytes: Uint8Array,
): Promise<{ readonly width: number; readonly height: number } | undefined> {
  if (imageTypeOf(bytes) === 'image/tiff') {
    return readTiffStructure(bytes)?.largest;
  }
  try {
    const { width, height } = await sharp(bytes).metadata();
    return { width, height };
  } catch {
    // sharp throws for any image it can't parse; the caller hears why.
    return undefined;
  }
}

/**
 * Accepts JPEGs, PNGs, WebPs (U34) and TIFFs, raws such as ARWs too (U20), known by their first bytes, up to a
 * number of pixels, checked from the header so that a small file claiming
 * huge dimensions (a decompression bomb) is never decoded.
 */
export class SharpImageInspector implements ImageInspector {
  readonly #maxPixels: number;

  constructor(maxPixels: number) {
    this.#maxPixels = maxPixels;
  }

  async inspect(bytes: Uint8Array): Promise<Result<ImageFacts, ImageRejected>> {
    if (imageTypeOf(bytes) === undefined) {
      return err({ kind: 'image-rejected', reason: 'unsupported-type' });
    }
    const size = await sizeOf(bytes);
    if (size === undefined) {
      return err({ kind: 'image-rejected', reason: 'unreadable' });
    }
    const { width, height } = size;
    if (width * height > this.#maxPixels) {
      return err({
        kind: 'image-rejected',
        reason: 'too-many-pixels',
        maxPixels: this.#maxPixels,
      });
    }
    return ok({
      sha256: createHash('sha256').update(bytes).digest('hex'),
      bytes: bytes.length,
      width,
      height,
    });
  }
}
