import { expect, test } from 'vitest';
import { sha256Hex } from './sha256-hex.ts';

test('gives the standard SHA-256 of text', async () => {
  expect(await sha256Hex('abc')).toBe(
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
  );
});
