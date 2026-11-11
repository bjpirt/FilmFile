import sharp from 'sharp';
import type {
  Credit,
  ExportRecipe,
  ImageRenderer,
} from '../../../application/ports/image-renderer.ts';
import type { QuarterTurn } from '../../../domain/rolls/quarter-turn.ts';
import { previewSource } from './preview-source.ts';

/** JPEGs made with sharp, which carry the author and copyright as EXIF and nothing else. */
export class SharpImageRenderer implements ImageRenderer {
  readonly #maxPixels: number;

  constructor(maxPixels: number) {
    this.#maxPixels = maxPixels;
  }

  async render(
    file: Uint8Array,
    rotate: QuarterTurn,
    recipe: ExportRecipe,
    credit: Credit,
  ): Promise<Uint8Array> {
    const image = sharp(previewSource(file), {
      limitInputPixels: this.#maxPixels,
    }).rotate(rotate);
    const sized =
      recipe.longestEdge === null
        ? image
        : image.resize(recipe.longestEdge, recipe.longestEdge, {
            fit: 'inside',
            withoutEnlargement: true,
          });
    return await sized
      .jpeg({ quality: recipe.quality })
      .withExif({
        IFD0: {
          ...(credit.author === undefined ? {} : { Artist: credit.author }),
          ...(credit.copyright === undefined
            ? {}
            : { Copyright: credit.copyright }),
        },
      })
      .toBuffer();
  }
}
