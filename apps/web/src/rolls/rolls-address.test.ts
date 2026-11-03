import { expect, test } from 'vitest';
import { addressOf, readAddress } from './rolls-address.ts';

test.each([
  ['', { view: undefined, group: 'none', year: undefined }, '/'],
  [
    '?view=list',
    { view: 'list', group: 'none', year: undefined },
    '/?view=list',
  ],
  [
    '?view=grid&group=year&year=2026',
    { view: 'grid', group: 'year', year: '2026' },
    '/?view=grid&group=year&year=2026',
  ],
] as const)(
  'reads %j and writes it back the same',
  (search, address, written) => {
    expect(readAddress(search)).toEqual(address);
    expect(addressOf(address)).toBe(written);
  },
);

test('ignores what it does not recognise', () => {
  expect(readAddress('?view=table&group=camera&year=26&other=1')).toEqual({
    view: undefined,
    group: 'none',
    year: undefined,
  });
});
