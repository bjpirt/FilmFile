import { expect, test } from 'vitest';
import { aFrame, aRoll } from '../testing/fake-archive.ts';
import { eventsOfFrame, eventsOfRoll } from './frame-events.ts';

const frame = aFrame('1', '12340001.jpg');

test('a frame is in its own event, or falls back to its roll’s', () => {
  const roll = aRoll('2026-014', { event: 'iceland-2026' });

  expect(eventsOfFrame(frame, roll)).toEqual(['iceland-2026']);
  expect(eventsOfFrame({ ...frame, event: 'westfjords' }, roll)).toEqual([
    'westfjords',
  ]);
  expect(eventsOfFrame({ ...frame, event: null }, aRoll('2026-015'))).toEqual(
    [],
  );
  expect(eventsOfFrame(frame, aRoll('2026-015'))).toEqual([]);
});

test('a roll is in its own event and every event any of its frames is in, each once', () => {
  const roll = aRoll('2026-014', {
    event: 'iceland-2026',
    frames: [
      frame,
      { ...aFrame('2', '12340002.jpg'), event: 'westfjords' },
      { ...aFrame('3', '12340003.jpg'), event: 'puffins' },
    ],
  });

  expect(eventsOfRoll(roll)).toEqual(['iceland-2026', 'westfjords', 'puffins']);
  expect(eventsOfRoll(aRoll('2026-015'))).toEqual([]);
});
