import { expect, test } from 'vitest';
import { lensLabel } from './lens.ts';

test.each([
  [
    { make: 'Nikon', name: 'Nikkor AI-S', focalLength: 50, maxAperture: 1.8 },
    'Nikon Nikkor AI-S 50mm f/1.8',
  ],
  [
    { make: 'Leica', name: 'Summicron', focalLength: 35, maxAperture: 2 },
    'Leica Summicron 35mm f/2',
  ],
  [
    { make: 'Zeiss', name: 'Planar', focalLength: null, maxAperture: null },
    'Zeiss Planar',
  ],
])('calls %j %j', (lens, label) => {
  expect(lensLabel(lens)).toBe(label);
});
