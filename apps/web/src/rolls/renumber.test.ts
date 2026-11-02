import fc from 'fast-check';
import { expect, test } from 'vitest';
import { renumber } from './renumber.ts';

test.each([
  ['first scan is 1, counting up', 'first', 1, 'up', 4, ['1', '2', '3', '4']],
  [
    'first scan is 6, counting down',
    'first',
    6,
    'down',
    6,
    ['6', '5', '4', '3', '2', '1'],
  ],
  [
    'last scan is 1, counting down',
    'last',
    1,
    'down',
    6,
    ['6', '5', '4', '3', '2', '1'],
  ],
  ['last scan is 36, counting up', 'last', 36, 'up', 3, ['34', '35', '36']],
  [
    'first scan is 2, counting down past zero',
    'first',
    2,
    'down',
    4,
    ['2', '1', '0', '-1'],
  ],
  [
    'last scan is 0, counting up from below zero',
    'last',
    0,
    'up',
    3,
    ['-2', '-1', '0'],
  ],
  ['no scans', 'last', 1, 'up', 0, []],
] as const)(
  'numbers scans when the %s',
  (_case, from, number, direction, count, expected) => {
    expect(renumber(count, { from, number, direction })).toEqual(expected);
  },
);

test('gives each scan a number one step from the last, with the chosen scan getting the chosen number', () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 1, max: 50 }),
      fc.integer({ min: -100, max: 100 }),
      fc.constantFrom('up' as const, 'down' as const),
      fc.constantFrom('first' as const, 'last' as const),
      (count, number, direction, from) => {
        const numbers = renumber(count, { from, number, direction }).map(
          Number,
        );
        const step = direction === 'up' ? 1 : -1;

        expect(numbers).toHaveLength(count);
        expect(from === 'first' ? numbers[0] : numbers.at(-1)).toBe(number);
        numbers.slice(1).forEach((n, i) => {
          expect(n - (numbers[i] ?? 0)).toBe(step);
        });
      },
    ),
  );
});
