import { expect, test } from 'vitest';
import { formatBytes } from './format-bytes.ts';

test.each([
  [0, '0 B'],
  [512, '512 B'],
  [2_048, '2 KB'],
  [1_200_000_000, '1.2 GB'],
  [34_000_000_000, '34 GB'],
  [9_960_000, '10 MB'],
  [5_000_000_000_000_000, '5000 TB'],
])('shows %i bytes as %s', (bytes, shown) => {
  expect(formatBytes(bytes)).toBe(shown);
});
