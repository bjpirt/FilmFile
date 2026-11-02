import { expect, test } from 'vitest';
import { newUlid } from './new-ulid.ts';

test('is 26 Crockford base32 characters', () => {
  expect(newUlid()).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
});

test('encodes the time first, as in the ULID spec', () => {
  expect(newUlid(1469918176385).slice(0, 10)).toBe('01ARYZ6S41');
});

test('sorts IDs made later after earlier ones', () => {
  expect(newUlid(1000) < newUlid(2000)).toBe(true);
});

test('makes a different ID each time, even in the same millisecond', () => {
  expect(newUlid(1000)).not.toBe(newUlid(1000));
});
