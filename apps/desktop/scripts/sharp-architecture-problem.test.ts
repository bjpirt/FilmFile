import { expect, test } from 'vitest';
import { sharpArchitectureProblem } from './sharp-architecture-problem.ts';

test('none when the app holds sharp for its own architecture only', () => {
  expect(
    sharpArchitectureProblem(
      ['colour', 'sharp-darwin-arm64', 'sharp-libvips-darwin-arm64'],
      'arm64',
    ),
  ).toBeUndefined();
  expect(
    sharpArchitectureProblem(
      ['sharp-darwin-x64', 'sharp-libvips-darwin-x64'],
      'x64',
    ),
  ).toBeUndefined();
});

test('says so when it also holds another architecture’s', () => {
  expect(
    sharpArchitectureProblem(
      [
        'colour',
        'sharp-darwin-arm64',
        'sharp-darwin-x64',
        'sharp-libvips-darwin-arm64',
        'sharp-libvips-darwin-x64',
      ],
      'arm64',
    ),
  ).toBe(
    'FilmFile.app would hold sharp for arm64 and x64; it should hold only arm64’s.',
  );
});

test('says so when it holds only another architecture’s', () => {
  expect(
    sharpArchitectureProblem(
      ['sharp-darwin-arm64', 'sharp-libvips-darwin-arm64'],
      'x64',
    ),
  ).toBe('FilmFile.app would hold sharp for arm64; it should hold only x64’s.');
});

test('says so when it holds none', () => {
  expect(sharpArchitectureProblem(['colour'], 'arm64')).toBe(
    'FilmFile.app would hold no sharp; it should hold arm64’s.',
  );
});
