import { expect, test } from 'vitest';
import { isArchiveId, isFrameId, isRollId } from '../shared/ids.ts';
import { isShotDate } from '../rolls/shot-date.ts';
import { isSlug } from '../shared/slug.ts';
import { archiveLayer, frameLayer, rollLayer } from './layers.ts';

const archiveId = '01JC8Y0000000000000000000A';
const rollId = '01JC8Z7K3M0000000002026014';
const frameId = '01JC8Z7K3M00000000000F0001';
const camera = 'nikon-fe';
const event = 'iceland-2026';
const shot = '2026-09-14T06:30';
if (
  !isArchiveId(archiveId) ||
  !isRollId(rollId) ||
  !isFrameId(frameId) ||
  !isSlug(camera) ||
  !isSlug(event) ||
  !isShotDate(shot)
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

test('a roll gives the equipment it has, its event as a list of one, and its date shot', () => {
  expect(
    rollLayer({ id: rollId, camera, film: null, lens: null, event, shot }),
  ).toEqual({
    source: { layer: 'roll', id: rollId },
    details: { camera, events: [event], shot },
  });
});

test('a frame gives only what it sets itself, its events as they are', () => {
  expect(
    frameLayer({
      id: frameId,
      camera: null,
      lens: camera,
      events: [event, camera],
      shot,
    }),
  ).toEqual({
    source: { layer: 'frame', id: frameId },
    details: { lens: camera, events: [event, camera], shot },
  });
});

test('a frame that sets nothing gives nothing, so it inherits everything', () => {
  expect(
    frameLayer({
      id: frameId,
      camera: null,
      lens: null,
      events: null,
      shot: null,
    }).details,
  ).toEqual({});
});
