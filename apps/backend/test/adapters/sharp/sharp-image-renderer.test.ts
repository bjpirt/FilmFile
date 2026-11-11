import sharp from 'sharp';
import { describe, expect, test } from 'vitest';
import { SharpImageRenderer } from '../../../src/adapters/outbound/sharp/sharp-image-renderer.ts';
import { aJpeg } from '../../support/a-jpeg.ts';
import { aRaw } from '../../support/a-raw.ts';

const renderer = new SharpImageRenderer(100_000_000);
const full = { longestEdge: null, quality: 90 };

async function sizeOf(jpeg: Uint8Array) {
  const { format, width, height } = await sharp(jpeg).metadata();
  return { format, width, height };
}

describe('SharpImageRenderer', () => {
  test('makes a JPEG at the size and no larger than the image', async () => {
    const original = new Uint8Array(await aJpeg({ width: 600, height: 400 }));

    expect(
      await sizeOf(
        await renderer.render(original, 0, { ...full, longestEdge: 300 }, {}),
      ),
    ).toEqual({ format: 'jpeg', width: 300, height: 200 });
    expect(
      await sizeOf(
        await renderer.render(original, 0, { ...full, longestEdge: 2048 }, {}),
      ),
    ).toEqual({ format: 'jpeg', width: 600, height: 400 });
    expect(await sizeOf(await renderer.render(original, 0, full, {}))).toEqual({
      format: 'jpeg',
      width: 600,
      height: 400,
    });
  });

  test('turns the image as it is shown', async () => {
    const original = new Uint8Array(await aJpeg({ width: 600, height: 400 }));

    expect(await sizeOf(await renderer.render(original, 90, full, {}))).toEqual(
      { format: 'jpeg', width: 400, height: 600 },
    );
  });

  test('a lower quality makes a smaller file', async () => {
    // Noise, which a flat image would hide the difference in.
    const original = new Uint8Array(
      await sharp({
        create: {
          width: 300,
          height: 200,
          channels: 3,
          background: { r: 128, g: 128, b: 128 },
          noise: { type: 'gaussian', mean: 128, sigma: 40 },
        },
      })
        .jpeg()
        .toBuffer(),
    );

    const high = await renderer.render(
      original,
      0,
      { ...full, quality: 95 },
      {},
    );
    const low = await renderer.render(
      original,
      0,
      { ...full, quality: 20 },
      {},
    );

    expect(low.length).toBeLessThan(high.length);
  });

  test('makes a raw from the largest preview it carries', async () => {
    const raw = await aRaw({
      sensor: { width: 6000, height: 4000 },
      preview: { width: 600, height: 400 },
    });

    expect(await sizeOf(await renderer.render(raw, 0, full, {}))).toEqual({
      format: 'jpeg',
      width: 600,
      height: 400,
    });
  });

  test('carries the author and copyright, and nothing about where it was taken', async () => {
    const original = new Uint8Array(await aJpeg());

    const made = await renderer.render(original, 0, full, {
      author: 'Ben Pirt',
      copyright: 'All rights reserved',
    });

    const exif = (await sharp(made).metadata()).exif?.toString('latin1') ?? '';
    expect(exif).toContain('Ben Pirt');
    expect(exif).toContain('All rights reserved');
    expect(exif).not.toContain('GPS');
  });

  test('says nothing of who made it when there is no credit', async () => {
    const made = await renderer.render(
      new Uint8Array(await aJpeg()),
      0,
      full,
      {},
    );

    expect(
      (await sharp(made).metadata()).exif?.toString('latin1') ?? '',
    ).not.toContain('Ben');
  });
});
