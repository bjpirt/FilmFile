import sharp from 'sharp';

/** An image's format and size, for tests that check what a file is. */
export async function imageSizeOf(
  file: Uint8Array,
): Promise<{ format: string; width: number; height: number }> {
  const { format, width, height } = await sharp(file).metadata();
  return { format, width, height };
}
