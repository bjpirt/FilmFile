import type { PreviewProvider } from '../../../application/ports/preview-provider.ts';
import type { QuarterTurn } from '../../../domain/rolls/quarter-turn.ts';
import type { ThumbnailSize } from '../../../domain/rolls/thumbnail-size.ts';

/**
 * Stands in for real thumbnails in tests: a "thumbnail" is the text
 * `<size> of <original>`, with `turned <rotate>` if it's turned, and each
 * one is made once, like a cached one.
 */
export class InMemoryPreviewProvider implements PreviewProvider {
  readonly #made = new Map<string, Uint8Array>();
  originalsLoaded = 0;

  async thumbnail(
    sha256: string,
    size: ThumbnailSize,
    rotate: QuarterTurn,
    original: () => Promise<Uint8Array>,
  ): Promise<Uint8Array> {
    const key = `${sha256}-${size}-${String(rotate)}`;
    const cached = this.#made.get(key);
    if (cached !== undefined) {
      return cached;
    }
    this.originalsLoaded += 1;
    const text = `${size} of ${new TextDecoder().decode(await original())}${rotate === 0 ? '' : ` turned ${String(rotate)}`}`;
    const made = new TextEncoder().encode(text);
    this.#made.set(key, made);
    return made;
  }
}
