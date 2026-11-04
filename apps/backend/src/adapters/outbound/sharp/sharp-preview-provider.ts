import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import type { PreviewProvider } from '../../../application/ports/preview-provider.ts';
import type { QuarterTurn } from '../../../domain/rolls/quarter-turn.ts';
import type { ThumbnailSize } from '../../../domain/rolls/thumbnail-size.ts';
import { imageTypeOf } from '../../../domain/rolls/image-type.ts';
import { hasErrorCode } from '../filesystem/error-codes.ts';
import { safePath } from '../filesystem/safe-path.ts';
import { readTiffStructure, type EmbeddedJpeg } from './tiff-structure.ts';

const pixels: Record<ThumbnailSize, number> = { small: 400, large: 2048 };

/**
 * What a thumbnail is made from: a raw's largest preview JPEG where it
 * carries one, since sharp can't develop a raw (U20); otherwise the file
 * itself, a plain TIFF included.
 */
function previewSource(file: Uint8Array): Uint8Array {
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

/** WebP thumbnails made with sharp, cached in the OS cache folder by content hash and turn. */
export class SharpPreviewProvider implements PreviewProvider {
  readonly #cachePath: string;
  readonly #maxPixels: number;

  constructor(cachePath: string, maxPixels: number) {
    this.#cachePath = cachePath;
    this.#maxPixels = maxPixels;
  }

  async thumbnail(
    sha256: string,
    size: ThumbnailSize,
    rotate: QuarterTurn,
    original: () => Promise<Uint8Array>,
  ): Promise<Uint8Array> {
    const cached = safePath(
      this.#cachePath,
      'thumbnails',
      // Unturned ones keep the names they had before versions could be turned.
      `${sha256}-${size}${rotate === 0 ? '' : `-${String(rotate)}`}.webp`,
    );
    try {
      return await readFile(cached);
    } catch (error) {
      if (!hasErrorCode(error, 'ENOENT')) {
        throw error;
      }
    }
    const made = await sharp(previewSource(await original()), {
      limitInputPixels: this.#maxPixels,
    })
      .rotate(rotate)
      .resize(pixels[size], pixels[size], {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp()
      .toBuffer();
    await mkdir(path.dirname(cached), { recursive: true });
    await writeFile(cached, made);
    return made;
  }
}
