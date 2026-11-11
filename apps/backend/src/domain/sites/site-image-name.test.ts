import { expect, test } from 'vitest';
import { isFrameId, type FrameId } from '../shared/ids.ts';
import {
  siteImageInputsText,
  siteImagePath,
  type SiteImageInputs,
} from './site-image-name.ts';

const frame = ((): FrameId => {
  const id = '01JD8M2KZXQ4T6V8W0Y1A3C5E7';
  if (!isFrameId(id)) {
    throw new Error('bad test data');
  }
  return id;
})();

const inputs: SiteImageInputs = {
  sha256: 'abc',
  rotate: 90,
  longestEdge: 960,
  author: 'Ben',
  copyright: undefined,
};

test('names an image by its frame, size and the start of its inputs’ hash', () => {
  expect(siteImagePath(frame, 960, 'f00dfeedbeefcafe1234')).toBe(
    'images/Y1A3C5E7-960-f00dfeedbeef.jpg',
  );
});

test.each<[string, Partial<SiteImageInputs>]>([
  ['the scan', { sha256: 'abd' }],
  ['its turn', { rotate: 180 }],
  ['its size', { longestEdge: 1600 }],
  ['the author', { author: 'Sam' }],
  ['the copyright', { copyright: '© Ben' }],
])('a change to %s changes the inputs', (_name, change) => {
  expect(siteImageInputsText({ ...inputs, ...change })).not.toBe(
    siteImageInputsText(inputs),
  );
});

test('the same inputs are the same text', () => {
  expect(siteImageInputsText({ ...inputs })).toBe(siteImageInputsText(inputs));
});
