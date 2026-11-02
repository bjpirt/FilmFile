import type { ImageRejected } from '../../domain/shared/domain-error.ts';
import type { Result } from '../../domain/shared/result.ts';

/** What the catalogue records about an image file. */
export interface ImageFacts {
  readonly sha256: string;
  readonly bytes: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Checks an uploaded file is an image the catalogue can accept, reading its
 * dimensions from its header without decoding it.
 */
export interface ImageInspector {
  inspect(bytes: Uint8Array): Promise<Result<ImageFacts, ImageRejected>>;
}
