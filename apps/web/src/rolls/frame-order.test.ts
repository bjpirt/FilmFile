import fc from 'fast-check';
import { expect, test } from 'vitest';
import { compareFrameNumbers, inFrameOrder } from './frame-order.ts';

function sorted(numbers: (string | null)[]): (string | null)[] {
  return [...numbers].sort(compareFrameNumbers);
}

test.each([
  ['plain numbers by value, not as text', ['10', '2', '1'], ['1', '2', '10']],
  ['negatives first', ['1', '-1', '0', '-2'], ['-2', '-1', '0', '1']],
  ['00 just before 0, as on the film', ['1', '0', '00'], ['00', '0', '1']],
  ['a letter after its number', ['13', '12A', '12'], ['12', '12A', '13']],
  ['a range at its first number', ['15', '14-15', '14'], ['14', '14-15', '15']],
  ['text with no number after the numbers', ['X', '2', 'A1'], ['2', 'A1', 'X']],
  ['no number last', [null, '1', 'X', null], ['1', 'X', null, null]],
])('sorts %s', (_case, numbers, expected) => {
  expect(sorted(numbers)).toEqual(expected);
});

test('gives the same order whatever order the frames start in', () => {
  const aNumber = fc.option(fc.string({ maxLength: 9 }), { nil: null });
  fc.assert(
    fc.property(fc.array(aNumber), (numbers) => {
      expect(sorted([...numbers].reverse())).toEqual(sorted(numbers));
    }),
  );
});

test('puts frames in frame order, keeping scan order between equal numbers', () => {
  const frames = [
    { id: 'a', number: '2' },
    { id: 'b', number: '1' },
    { id: 'c', number: '2' },
  ];

  expect(inFrameOrder(frames).map((f) => f.id)).toEqual(['b', 'a', 'c']);
  expect(frames.map((f) => f.id)).toEqual(['a', 'b', 'c']);
});
