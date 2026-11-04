import { createHash } from 'node:crypto';
import sharp from 'sharp';
import type {
  ImageFacts,
  ImageInspector,
} from '../../../application/ports/image-inspector.ts';
import type { ImageRejected } from '../../../domain/shared/domain-error.ts';
import { imageTypeOf } from '../../../domain/rolls/image-type.ts';
import { err, ok, type Result } from '../../../domain/shared/result.ts';

/**
 * Accepts JPEGs, PNGs and WebPs (U34), known by their first bytes, up to a
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
    let width: number;
    let height: number;
    try {
      ({ width, height } = await sharp(bytes).metadata());
    } catch {
      // sharp throws for any image it can't parse; the caller hears why.
      return err({ kind: 'image-rejected', reason: 'unreadable' });
    }
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
