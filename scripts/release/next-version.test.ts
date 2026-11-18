import { expect, test } from 'vitest';
import { nextVersion } from './next-version.ts';

test.each([
  ['patch', '0.3.3'],
  ['minor', '0.4.0'],
  ['major', '1.0.0'],
] as const)('from 0.3.2, %s gives %s', (bump, expected) => {
  expect(nextVersion('0.3.2', bump, { released: true })).toBe(expected);
});

test('before any release, the version is kept as it is, whichever is chosen', () => {
  for (const bump of ['patch', 'minor', 'major'] as const) {
    expect(nextVersion('0.1.0', bump, { released: false })).toBe('0.1.0');
  }
});

test('counts past 9', () => {
  expect(nextVersion('1.9.9', 'patch', { released: true })).toBe('1.9.10');
  expect(nextVersion('1.9.9', 'minor', { released: true })).toBe('1.10.0');
});

test('a version that isn’t major.minor.patch is a bug, and throws', () => {
  expect(() => nextVersion('0.4', 'patch', { released: true })).toThrow();
  expect(() =>
    nextVersion('0.4.0-beta.1', 'patch', { released: true }),
  ).toThrow();
});
