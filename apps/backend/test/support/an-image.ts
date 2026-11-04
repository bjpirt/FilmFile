import sharp from 'sharp';

/** A small image in the format given; different shades give different bytes. */
export function anImage(
  format: 'jpeg' | 'png' | 'webp',
  options: { width?: number; height?: number; shade?: number } = {},
): Promise<Buffer> {
  const { width = 30, height = 20, shade = 128 } = options;
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: shade, g: shade, b: shade },
    },
  })
    .toFormat(format)
    .toBuffer();
}
