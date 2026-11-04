import sharp from 'sharp';
import { describe, expect, test } from 'vitest';
import { aRaw } from '../../support/a-raw.ts';
import { readTiffStructure } from '../../../src/adapters/outbound/sharp/tiff-structure.ts';

describe('a TIFF’s structure', () => {
  test('gives a plain TIFF’s size, with no previews', async () => {
    const tiff = new Uint8Array(
      await sharp({
        create: { width: 30, height: 20, channels: 3, background: 'gray' },
      })
        .tiff()
        .toBuffer(),
    );

    expect(readTiffStructure(tiff)).toEqual({
      largest: { width: 30, height: 20 },
      previews: [],
    });
  });

  test('finds a raw’s full size in its sub-table, and the preview it carries', async () => {
    const raw = await aRaw({
      sensor: { width: 6000, height: 4000 },
      preview: { width: 600, height: 400 },
    });

    const structure = readTiffStructure(raw);

    expect(structure?.largest).toEqual({ width: 6000, height: 4000 });
    const [preview] = structure?.previews ?? [];
    const jpeg = raw.subarray(
      preview?.offset,
      (preview?.offset ?? 0) + (preview?.length ?? 0),
    );
    expect(await sharp(jpeg).metadata()).toMatchObject({
      format: 'jpeg',
      width: 600,
      height: 400,
    });
  });

  test('isn’t fooled by a preview that runs past the end of the file', async () => {
    const raw = await aRaw();
    const cut = raw.subarray(0, raw.length - 100);

    expect(readTiffStructure(cut)?.previews).toEqual([]);
  });

  test('stops at tables that point back at themselves', () => {
    // IFD0 at 8 with no entries, whose "next table" is itself.
    const looped = new Uint8Array([
      0x49, 0x49, 42, 0, 8, 0, 0, 0, 0, 0, 8, 0, 0, 0,
    ]);

    expect(readTiffStructure(looped)).toEqual({
      largest: undefined,
      previews: [],
    });
  });

  test('is undefined for something that isn’t a TIFF', () => {
    expect(
      readTiffStructure(new Uint8Array([0xff, 0xd8, 0xff])),
    ).toBeUndefined();
  });
});
