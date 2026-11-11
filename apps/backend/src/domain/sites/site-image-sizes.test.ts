import { expect, test } from 'vitest';
import { siteImageSizes, turnedSize } from './site-image-sizes.ts';

test('makes a large scan at each size, keeping its shape', () => {
  expect(siteImageSizes(6000, 4000, 0)).toEqual([
    { longestEdge: 480, width: 480, height: 320 },
    { longestEdge: 960, width: 960, height: 640 },
    { longestEdge: 1600, width: 1600, height: 1067 },
  ]);
});

test('makes a scan smaller than a size once at its own size, never enlarging', () => {
  expect(siteImageSizes(1200, 800, 0)).toEqual([
    { longestEdge: 480, width: 480, height: 320 },
    { longestEdge: 960, width: 960, height: 640 },
    { longestEdge: 1200, width: 1200, height: 800 },
  ]);
  expect(siteImageSizes(300, 200, 0)).toEqual([
    { longestEdge: 300, width: 300, height: 200 },
  ]);
});

test('a scan exactly the widest size is not made twice', () => {
  expect(siteImageSizes(1600, 1000, 0).map((size) => size.longestEdge)).toEqual(
    [480, 960, 1600],
  );
});

test('swaps the sides of a scan turned a quarter either way', () => {
  expect(turnedSize(300, 200, 90)).toEqual({ width: 200, height: 300 });
  expect(turnedSize(300, 200, 270)).toEqual({ width: 200, height: 300 });
  expect(turnedSize(300, 200, 180)).toEqual({ width: 300, height: 200 });
  expect(siteImageSizes(6000, 4000, 90)[2]).toEqual({
    longestEdge: 1600,
    width: 1067,
    height: 1600,
  });
});
