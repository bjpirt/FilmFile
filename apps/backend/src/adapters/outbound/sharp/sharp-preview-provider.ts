import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import type { PreviewProvider } from '../../../application/ports/preview-provider.ts';
import type { ThumbnailSize } from '../../../domain/rolls/thumbnail-size.ts';
import { hasErrorCode } from '../filesystem/error-codes.ts';
import { safePath } from '../filesystem/safe-path.ts';

const pixels: Record<ThumbnailSize, number> = { small: 400, large: 2048 };

/** WebP thumbnails made with sharp, cached in the OS cache folder by content hash. */
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
    original: () => Promise<Uint8Array>,
  ): Promise<Uint8Array> {
    const cached = safePath(
      this.#cachePath,
      'thumbnails',
      `${sha256}-${size}.webp`,
    );
    try {
      return await readFile(cached);
    } catch (error) {
      if (!hasErrorCode(error, 'ENOENT')) {
        throw error;
      }
    }
    const made = await sharp(await original(), {
      limitInputPixels: this.#maxPixels,
    })
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
