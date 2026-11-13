import { expect, test } from 'vitest';
import { siteManifestJson, type SiteManifest } from './site-manifest.ts';

const manifest: SiteManifest = {
  version: 1,
  design: 2,
  options: {
    title: 'Iceland',
    copyright: '',
    captions: ['title'],
  },
  photos: [],
};

test('writes the manifest as indented JSON ending in a newline', () => {
  const text = siteManifestJson(manifest);
  expect(text.endsWith('}\n')).toBe(true);
  expect(JSON.parse(text)).toEqual(manifest);
});

test('the same manifest is always the same bytes', () => {
  expect(siteManifestJson({ ...manifest })).toBe(siteManifestJson(manifest));
});
