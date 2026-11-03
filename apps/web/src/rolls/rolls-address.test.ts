import { expect, test } from 'vitest';
import { addressOf, readAddress } from './rolls-address.ts';

test.each([
  [
    '',
    {
      view: undefined,
      group: 'none',
      sort: 'number',
      year: undefined,
      camera: undefined,
      film: undefined,
    },
    '/',
  ],
  [
    '?view=list',
    {
      view: 'list',
      group: 'none',
      sort: 'number',
      year: undefined,
      camera: undefined,
      film: undefined,
    },
    '/?view=list',
  ],
  [
    '?view=grid&group=year&sort=shot&year=2026',
    {
      view: 'grid',
      group: 'year',
      sort: 'shot',
      year: '2026',
      camera: undefined,
      film: undefined,
    },
    '/?view=grid&group=year&sort=shot&year=2026',
  ],
  [
    '?group=camera&camera=nikon-fe',
    {
      view: undefined,
      group: 'camera',
      sort: 'number',
      year: undefined,
      camera: 'nikon-fe',
      film: undefined,
    },
    '/?group=camera&camera=nikon-fe',
  ],
  [
    '?group=film&film=kodak-portra-400',
    {
      view: undefined,
      group: 'film',
      sort: 'number',
      year: undefined,
      camera: undefined,
      film: 'kodak-portra-400',
    },
    '/?group=film&film=kodak-portra-400',
  ],
] as const)(
  'reads %j and writes it back the same',
  (search, address, written) => {
    expect(readAddress(search)).toEqual(address);
    expect(addressOf(address)).toBe(written);
  },
);

test('ignores what it does not recognise', () => {
  expect(
    readAddress(
      '?view=table&group=lens&sort=size&year=26&camera=Nikon%20FE&film=../x&other=1',
    ),
  ).toEqual({
    view: undefined,
    group: 'none',
    sort: 'number',
    year: undefined,
    camera: undefined,
    film: undefined,
  });
});
