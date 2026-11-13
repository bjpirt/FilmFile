import { expect, test } from 'vitest';
import { parseSiteManifestFile } from '../../../src/adapters/outbound/filesystem/site-manifest-file.ts';

test('reads a site.json from before sites had cards (D104) or a design version (D107), so the site is only out of date', () => {
  const older = JSON.stringify({
    version: 1,
    options: { title: 'Iceland', groupBy: 'roll', captions: ['title'] },
    photos: [
      {
        frame: '01JD8M2KZXQ4T6V8W0Y1A3C5E7',
        alt: 'Roll 2026-014, frame 1',
        images: [{ src: 'images/a.jpg', width: 480, madeFrom: 'abc' }],
        width: 480,
        height: 320,
        roll: { key: 'r', heading: '2026-014' },
        details: {},
      },
    ],
  });

  const manifest = parseSiteManifestFile(older);

  expect(manifest.design).toBe(1);
  expect(manifest.options).toEqual({ title: 'Iceland', captions: ['title'] });
  expect(manifest.photos[0]).toMatchObject({
    rating: null,
    roll: { key: 'r', heading: '2026-014', file: '' },
  });
});
