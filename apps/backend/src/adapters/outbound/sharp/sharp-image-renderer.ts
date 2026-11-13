import sharp, { type Sharp } from 'sharp';
import type {
  ImageMetadata,
  ExportRecipe,
  ImageRenderer,
} from '../../../application/ports/image-renderer.ts';
import type { QuarterTurn } from '../../../domain/rolls/quarter-turn.ts';
import { exifTags, xmpPacket } from './image-metadata-tags.ts';
import { previewSource } from './preview-source.ts';

/** JPEGs made with sharp, which carry the metadata given as EXIF and XMP, and nothing else. */
export class SharpImageRenderer implements ImageRenderer {
  readonly #maxPixels: number;

  constructor(maxPixels: number) {
    this.#maxPixels = maxPixels;
  }

  async render(
    file: Uint8Array,
    rotate: QuarterTurn,
    recipe: ExportRecipe,
    metadata: ImageMetadata,
  ): Promise<Uint8Array> {
    const image = (await this.#asStored(previewSource(file))).rotate(rotate);
    const sized =
      recipe.longestEdge === null
        ? image
        : image.resize(recipe.longestEdge, recipe.longestEdge, {
            fit: 'inside',
            withoutEnlargement: true,
          });
    return await sized
      .jpeg({ quality: recipe.quality })
      .withExif(exifTags(metadata))
      .withXmp(xmpPacket(metadata))
      .toBuffer();
  }

  /**
   * The image as stored, saying nothing of an EXIF orientation. The archive
   * shows a scan as stored, turned only as its version says, so an image made
   * from it must not carry the scan's orientation for a viewer to turn it
   * again. sharp drops the tag only when it applies it, so a scan carrying one
   * (rare) is first read out as plain pixels.
   */
  async #asStored(source: Uint8Array): Promise<Sharp> {
    const options = { limitInputPixels: this.#maxPixels };
    const { orientation } = await sharp(source, options).metadata();
    if (orientation === undefined || orientation === 1) {
      return sharp(source, options);
    }
    const { data, info } = await sharp(source, options)
      .raw()
      .toBuffer({ resolveWithObject: true });
    return sharp(data, {
      ...options,
      raw: { width: info.width, height: info.height, channels: info.channels },
    });
  }
}
