import { expect, test } from 'vitest';
import { isArchiveId, isRollId } from '../shared/ids.ts';
import { isSlug } from '../shared/slug.ts';
import { archiveLayer, rollLayer } from './layers.ts';

const archiveId = '01JC8Y0000000000000000000A';
const rollId = '01JC8Z7K3M0000000002026014';
const camera = 'nikon-fe';
const event = 'iceland-2026';
if (
  !isArchiveId(archiveId) ||
  !isRollId(rollId) ||
  !isSlug(camera) ||
  !isSlug(event)
) {
  throw new Error('bad test data');
}

test('the archive gives its author, and a copyright if it has one', () => {
  expect(
    archiveLayer({ id: archiveId, author: 'Ben Pirt', copyright: null }),
  ).toEqual({
    source: { layer: 'archive', id: archiveId },
    details: { author: 'Ben Pirt' },
  });
});

test('a roll gives the equipment it has, and its event as a list of one', () => {
  expect(
    rollLayer({ id: rollId, camera, film: null, lens: null, event }),
  ).toEqual({
    source: { layer: 'roll', id: rollId },
    details: { camera, events: [event] },
  });
});
