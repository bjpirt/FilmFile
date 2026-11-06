import { expect, test } from 'vitest';
import { aFrame, aRoll } from '../testing/fake-archive.ts';
import { ownDetails } from './own-details.ts';

const roll = aRoll('2026-014', {
  camera: 'nikon-fe',
  lens: 'nikkor-50',
  event: 'iceland-2026',
  shot: '2026-03-14',
});
const frame = aFrame('1', '12340001.jpg');

test('says nothing of a frame that uses its roll’s details', () => {
  expect(ownDetails(frame, roll)).toBeUndefined();
});

test('says nothing of details a frame sets the same as its roll', () => {
  expect(
    ownDetails(
      {
        ...frame,
        camera: 'nikon-fe',
        event: 'iceland-2026',
        shot: '2026-03-14',
      },
      roll,
    ),
  ).toBeUndefined();
});

test.each([
  [{ camera: 'leica-m6' }, 'Its own camera'],
  [{ camera: 'leica-m6', lens: 'summicron-35' }, 'Its own camera and lens'],
  [
    { camera: 'leica-m6', lens: 'summicron-35', event: 'westfjords' },
    'Its own camera, lens and event',
  ],
  [{ event: 'westfjords' }, 'Its own event'],
  [{ shot: '2026-03-15' }, 'Its own date'],
  [{ notes: 'Lens cap half on' }, 'Has notes'],
  [
    { lens: 'summicron-35', notes: 'Lens cap half on' },
    'Its own lens, and notes',
  ],
])('names the details a frame has of its own: %j', (own, text) => {
  expect(ownDetails({ ...frame, ...own }, roll)).toBe(text);
});

test('says nothing of notes that are only spaces', () => {
  expect(ownDetails({ ...frame, notes: '  ' }, roll)).toBeUndefined();
});
