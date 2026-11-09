import { describe, expect, test } from 'vitest';
import { aFrame, aRoll } from '../testing/fake-archive.ts';
import { groupFramesByEvent } from './group-by-event.ts';

function inEvent(number: string, event: string | null) {
  return { ...aFrame(number, `1234${number.padStart(4, '0')}.jpg`), event };
}

function summary(groups: ReturnType<typeof groupFramesByEvent>) {
  return groups.map((g) => [g.event, g.frames.map((f) => f.number)]);
}

describe('groupFramesByEvent', () => {
  test('is one group when every frame is in the same event, or none', () => {
    const together = aRoll('2026-014', {
      event: 'iceland',
      frames: [inEvent('1', null), inEvent('2', 'iceland')],
    });
    const nowhere = aRoll('2026-015', {
      frames: [inEvent('1', null), inEvent('2', null)],
    });

    expect(summary(groupFramesByEvent(together.frames, together))).toEqual([
      ['iceland', ['1', '2']],
    ]);
    expect(summary(groupFramesByEvent(nowhere.frames, nowhere))).toEqual([
      [null, ['1', '2']],
    ]);
  });

  test('groups by the event each frame is in, its own or its roll’s, in the order of their first frames', () => {
    const roll = aRoll('2026-014', {
      event: 'iceland',
      frames: [
        inEvent('1', null),
        inEvent('2', 'norway'),
        inEvent('3', 'iceland'),
        inEvent('4', 'norway'),
        inEvent('5', null),
      ],
    });

    expect(summary(groupFramesByEvent(roll.frames, roll))).toEqual([
      ['iceland', ['1', '3', '5']],
      ['norway', ['2', '4']],
    ]);
  });

  test('puts frames in no event last, whatever their place', () => {
    const roll = aRoll('2026-014', {
      frames: [
        inEvent('1', null),
        inEvent('2', 'norway'),
        inEvent('3', null),
        inEvent('4', 'iceland'),
      ],
    });

    expect(summary(groupFramesByEvent(roll.frames, roll))).toEqual([
      ['norway', ['2']],
      ['iceland', ['4']],
      [null, ['1', '3']],
    ]);
  });
});
