import type { QuarterTurn } from '../../domain/rolls/quarter-turn.ts';
import type { ThumbnailSize } from '../../domain/rolls/thumbnail-size.ts';

/** Thumbnails of image files, made on first request and cached by content hash and turn. */
export interface PreviewProvider {
  /**
   * A WebP thumbnail of the file with this hash, turned clockwise by
   * `rotate` (D41). `original` loads the file, and is only called if the
   * thumbnail isn't cached.
   */
  thumbnail(
    sha256: string,
    size: ThumbnailSize,
    rotate: QuarterTurn,
    original: () => Promise<Uint8Array>,
  ): Promise<Uint8Array>;
}
