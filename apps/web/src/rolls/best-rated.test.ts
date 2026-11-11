import { expect, test } from 'vitest';
import { bestRated } from './best-rated.ts';

const item = (name: string, rating: number | null) => ({
  name,
  frame: { rating },
});

test('takes the highest rated first, keeping the given order among equals, with unrated last', () => {
  const items = [
    item('a', null),
    item('b', 3),
    item('c', 5),
    item('d', 3),
    item('e', 5),
  ];

  expect(bestRated(items, 4).map((i) => i.name)).toEqual(['c', 'e', 'b', 'd']);
});

test('takes only as many as asked for, and leaves the list alone', () => {
  const items = [item('a', 1), item('b', 2), item('c', 3)];

  expect(bestRated(items, 2).map((i) => i.name)).toEqual(['c', 'b']);
  expect(items.map((i) => i.name)).toEqual(['a', 'b', 'c']);
});
