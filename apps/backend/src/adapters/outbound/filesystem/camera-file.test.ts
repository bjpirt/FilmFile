import { expect, test } from 'vitest';
import { cameraFileContent, parseCameraFile } from './camera-file.ts';

test('reads back exactly the camera written, byte for byte when written again', () => {
  const written = cameraFileContent({ make: 'Nikon', model: 'FE' });

  expect(parseCameraFile(written)).toEqual({ make: 'Nikon', model: 'FE' });
  expect(cameraFileContent(parseCameraFile(written))).toBe(written);
});

test.each([
  ['Nikon FE', { make: 'Nikon', model: 'FE' }],
  ['Canon AE-1 Program', { make: 'Canon', model: 'AE-1 Program' }],
  ['Holga', { make: 'Holga', model: '' }],
])(
  'upgrades a camera named %j before makes and models were kept apart',
  (name, camera) => {
    expect(parseCameraFile(JSON.stringify({ schema: 1, name }))).toEqual(
      camera,
    );
  },
);

test('refuses a file that is not a camera', () => {
  expect(() => parseCameraFile(JSON.stringify({ schema: 2 }))).toThrow();
});
