import sharp from 'sharp';
import { describe, expect, test } from 'vitest';
import { SharpImageRenderer } from '../../../src/adapters/outbound/sharp/sharp-image-renderer.ts';
import { aJpeg } from '../../support/a-jpeg.ts';
import { aRaw } from '../../support/a-raw.ts';

const renderer = new SharpImageRenderer(100_000_000);
const full = {
  longestEdge: null,
  quality: 90,
  metadata: 'everything',
} as const;

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

describe('SharpImageRenderer metadata', () => {
  async function metadataOf(metadata: object) {
    const made = await renderer.render(
      new Uint8Array(await aJpeg()),
      0,
      full,
      metadata,
    );
    const { exif, xmp } = await sharp(made).metadata();
    return {
      exif: exif?.toString('utf8') ?? '',
      xmp: xmp?.toString('utf8') ?? '',
    };
  }

  test('writes a full date and time to the EXIF and says a partial date only in the XMP', async () => {
    const full = await metadataOf({ shot: '2026-09-14T15:30' });
    const month = await metadataOf({ shot: '2026-09' });

    expect(full.exif).toContain('2026:09:14 15:30:00');
    expect(full.xmp).toContain('2026-09-14T15:30');
    expect(month.exif).not.toContain('2026');
    expect(month.xmp).toContain(
      '<photoshop:DateCreated>2026-09</photoshop:DateCreated>',
    );
  });

  test('escapes what it writes into the XMP', async () => {
    const { xmp } = await metadataOf({ title: 'Fish & <chips>' });

    expect(xmp).toContain('Fish &amp; &lt;chips&gt;');
  });

  test('writes only what is given', async () => {
    const { exif, xmp } = await metadataOf({ author: 'Ben Pirt' });

    expect(exif).toContain('Ben Pirt');
    expect(xmp).toContain('Ben Pirt');
    expect(xmp).not.toContain('Rating');
    expect(xmp).not.toContain('tiff:Make');
  });
});
