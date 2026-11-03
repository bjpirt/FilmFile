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
      event: undefined,
      camera: undefined,
      film: undefined,
      lens: undefined,
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
      event: undefined,
      camera: undefined,
      film: undefined,
      lens: undefined,
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
      event: undefined,
      camera: undefined,
      film: undefined,
      lens: undefined,
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
      event: undefined,
      camera: 'nikon-fe',
      film: undefined,
      lens: undefined,
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
      event: undefined,
      camera: undefined,
      film: 'kodak-portra-400',
      lens: undefined,
    },
    '/?group=film&film=kodak-portra-400',
  ],
  [
    '?group=lens&lens=zeiss-planar',
    {
      view: undefined,
      group: 'lens',
      sort: 'number',
      year: undefined,
      event: undefined,
      camera: undefined,
      film: undefined,
      lens: 'zeiss-planar',
    },
    '/?group=lens&lens=zeiss-planar',
  ],
  [
    '?group=event&event=iceland-2026',
    {
      view: undefined,
      group: 'event',
      sort: 'number',
      year: undefined,
      event: 'iceland-2026',
      camera: undefined,
      film: undefined,
      lens: undefined,
    },
    '/?group=event&event=iceland-2026',
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
      '?view=table&group=colour&sort=size&year=26&camera=Nikon%20FE&film=../x&lens=-&event=Iceland&other=1',
    ),
  ).toEqual({
    view: undefined,
    group: 'none',
    sort: 'number',
    year: undefined,
    event: undefined,
    camera: undefined,
    film: undefined,
    lens: undefined,
  });
});
