import { expect, test } from 'vitest';
import { noEventHeading, groupPhotos } from './group-photos.ts';
import type { GroupLabel, SitePhoto } from './site-photo.ts';
import { isFrameId, type FrameId } from '../shared/ids.ts';

const rollA: GroupLabel = { key: 'a', heading: '2026-001 Iceland', file: 'a' };
const rollB: GroupLabel = { key: 'b', heading: '2026-002 Norway', file: 'b' };
const iceland: GroupLabel = {
  key: 'ice',
  heading: 'Iceland',
  detail: '2026',
  file: 'ice',
};

function frameId(name: string): FrameId {
  const id = name.padStart(26, '0');
  if (!isFrameId(id)) {
    throw new Error(`bad test data: ${name}`);
  }
  return id;
}

function aPhoto(name: string, roll: GroupLabel, event?: GroupLabel): SitePhoto {
  return {
    frame: frameId(name),
    alt: name,
    images: [],
    width: 3,
    height: 2,
    file: name,
    rating: null,
    roll,
    ...(event === undefined ? {} : { event }),
    details: {},
  };
}

const names = (photos: readonly SitePhoto[]) =>
  photos.map((photo) => photo.alt);

test('one ungrouped list when not grouping', () => {
  const photos = [aPhoto('1', rollA), aPhoto('2', rollB)];
  expect(groupPhotos(photos, 'nothing')).toEqual([{ photos }]);
});

test('no groups at all when there are no photos', () => {
  expect(groupPhotos([], 'nothing')).toEqual([]);
  expect(groupPhotos([], 'roll')).toEqual([]);
});

test('groups by roll in the order of each roll’s first photo', () => {
  const groups = groupPhotos(
    [aPhoto('1', rollB), aPhoto('2', rollA), aPhoto('3', rollB)],
    'roll',
  );
  expect(groups.map((group) => group.label?.heading)).toEqual([
    '2026-002 Norway',
    '2026-001 Iceland',
  ]);
  expect(groups.map((group) => names(group.photos))).toEqual([
    ['1', '3'],
    ['2'],
  ]);
});

test('groups by event, with photos in no event last under "No event set"', () => {
  const groups = groupPhotos(
    [
      aPhoto('1', rollA),
      aPhoto('2', rollA, iceland),
      aPhoto('3', rollB),
      aPhoto('4', rollB, iceland),
    ],
    'event',
  );
  expect(groups.map((group) => group.label?.heading)).toEqual([
    'Iceland',
    noEventHeading,
  ]);
  expect(groups.map((group) => names(group.photos))).toEqual([
    ['2', '4'],
    ['1', '3'],
  ]);
});
