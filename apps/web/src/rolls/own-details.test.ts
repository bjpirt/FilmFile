import { expect, test } from 'vitest';
import { aFrame, aRoll } from '../testing/fake-archive.ts';
import { ownDetails } from './own-details.ts';

const roll = aRoll('2026-014', {
  camera: 'nikon-fe',
  lens: 'nikkor-50',
  event: 'iceland-2026',
});
const frame = aFrame('1', '12340001.jpg');

test('says nothing of a frame that uses its roll’s details', () => {
  expect(ownDetails(frame, roll)).toBeUndefined();
});

test('says nothing of details a frame sets the same as its roll', () => {
  expect(
    ownDetails(
      { ...frame, camera: 'nikon-fe', events: ['iceland-2026'] },
      roll,
    ),
  ).toBeUndefined();
});

test.each([
  [{ camera: 'leica-m6' }, 'Its own camera'],
  [{ camera: 'leica-m6', lens: 'summicron-35' }, 'Its own camera and lens'],
  [
    { film: 'portra-400', lens: 'summicron-35', events: ['westfjords'] },
    'Its own film stock, lens and events',
  ],
  [{ events: [] }, 'Its own events'],
])('names the details a frame has of its own: %j', (own, text) => {
  expect(ownDetails({ ...frame, ...own }, roll)).toBe(text);
});
