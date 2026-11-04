import { expect, test } from 'vitest';
import { imageTypeOf } from './image-type.ts';

const bytes = (...values: number[]) => new Uint8Array(values);
// ASCII, as the files carry it.
const RIFF = [0x52, 0x49, 0x46, 0x46];
const WEBP = [0x57, 0x45, 0x42, 0x50];
const WAVE = [0x57, 0x41, 0x56, 0x45];
const GIF89a = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61];

test.each([
  ['a JPEG', bytes(0xff, 0xd8, 0xff, 0xe0), 'image/jpeg'],
  ['a PNG', bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a), 'image/png'],
  ['a WebP', bytes(...RIFF, 1, 2, 3, 4, ...WEBP), 'image/webp'],
])('knows %s by its first bytes', (_case, file, type) => {
  expect(imageTypeOf(file)).toBe(type);
});

test.each([
  ['a GIF', bytes(...GIF89a)],
  ['a RIFF that isn’t WebP', bytes(...RIFF, 1, 2, 3, 4, ...WAVE)],
  ['too short to tell', bytes(0xff, 0xd8)],
  ['nothing', bytes()],
])('knows %s is none of them', (_case, file) => {
  expect(imageTypeOf(file)).toBeUndefined();
});
