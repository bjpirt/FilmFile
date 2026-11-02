import { createHash } from 'node:crypto';
import { expect, test } from 'vitest';
import { aJpeg } from '../../support/a-jpeg.ts';
import { SharpImageInspector } from '../../../src/adapters/outbound/sharp/sharp-image-inspector.ts';

test('reports a JPEG’s hash, size and dimensions', async () => {
  const image = new Uint8Array(await aJpeg({ width: 30, height: 20 }));

  expect(await new SharpImageInspector(600).inspect(image)).toEqual({
    ok: true,
    value: {
      sha256: createHash('sha256').update(image).digest('hex'),
      bytes: image.length,
      width: 30,
      height: 20,
    },
  });
});

test('refuses an image with more pixels than allowed', async () => {
  const image = new Uint8Array(await aJpeg({ width: 30, height: 20 }));

  expect(await new SharpImageInspector(599).inspect(image)).toEqual({
    ok: false,
    error: {
      kind: 'image-rejected',
      reason: 'too-many-pixels',
      maxPixels: 599,
    },
  });
});

test.each([
  ['not a JPEG', 'not-jpeg', [0x89, 0x50, 0x4e, 0x47]],
  ['unreadable', 'unreadable', [0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]],
])('refuses a file that is %s', async (_case, reason, bytes) => {
  expect(
    await new SharpImageInspector(600).inspect(new Uint8Array(bytes)),
  ).toEqual({ ok: false, error: { kind: 'image-rejected', reason } });
});
