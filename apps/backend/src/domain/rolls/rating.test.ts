import { expect, test } from 'vitest';
import { parseRating } from './rating.ts';

test.each([1, 2, 3, 4, 5])('accepts %d stars', (stars) => {
  expect(parseRating(stars)).toEqual({ ok: true, value: stars });
});

test.each([0, 6, 2.5, -1])('refuses %d', (stars) => {
  expect(parseRating(stars)).toMatchObject({
    ok: false,
    error: { issues: [{ path: ['rating'] }] },
  });
});
