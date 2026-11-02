import sharp from 'sharp';

/** A small JPEG; different shades give different bytes. */
export function aJpeg(
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
    .jpeg()
    .toBuffer();
}
