import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { aJpeg } from '../../support/a-jpeg.ts';
import { SharpPreviewProvider } from '../../../src/adapters/outbound/sharp/sharp-preview-provider.ts';

let cachePath = '';

beforeEach(async () => {
  cachePath = await mkdtemp(path.join(tmpdir(), 'filmfile-cache-'));
});

afterEach(async () => {
  await rm(cachePath, { recursive: true, force: true });
});

test.each([
  ['small', 400, 267],
  ['large', 2048, 1365],
] as const)('makes a %s WebP within %i px', async (size, width, height) => {
  const original = await aJpeg({ width: 3000, height: 2000 });
  const previews = new SharpPreviewProvider(cachePath, 100_000_000);

  const thumbnail = await previews.thumbnail('abc', size, () =>
    Promise.resolve(new Uint8Array(original)),
  );

  expect(await sharp(thumbnail).metadata()).toMatchObject({
    format: 'webp',
    width,
    height,
  });
});

test('makes each thumbnail once, then serves it from the cache', async () => {
  const original = new Uint8Array(await aJpeg());
  const previews = new SharpPreviewProvider(cachePath, 100_000_000);
  let loads = 0;
  const load = () => {
    loads += 1;
    return Promise.resolve(original);
  };

  const first = await previews.thumbnail('abc', 'small', load);
  const second = await previews.thumbnail('abc', 'small', load);

  expect(second).toEqual(first);
  expect(loads).toBe(1);
});
