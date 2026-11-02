import type { ThumbnailSize } from '../../domain/rolls/thumbnail-size.ts';

/** Thumbnails of image files, made on first request and cached by content hash. */
export interface PreviewProvider {
  /**
   * A WebP thumbnail of the file with this hash. `original` loads the file,
   * and is only called if the thumbnail isn't cached.
   */
  thumbnail(
    sha256: string,
    size: ThumbnailSize,
    original: () => Promise<Uint8Array>,
  ): Promise<Uint8Array>;
}
