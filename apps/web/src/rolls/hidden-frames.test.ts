import { expect, test } from 'vitest';
import { hiddenCount, shownFrames, showingHidden } from './hidden-frames.ts';

const frames = [{ hidden: false }, { hidden: true }, { hidden: false }];

test('leaves hidden frames out unless they are asked for', () => {
  expect(shownFrames(frames, false)).toEqual([
    { hidden: false },
    { hidden: false },
  ]);
  expect(shownFrames(frames, true)).toEqual(frames);
});

test('counts the hidden frames', () => {
  expect(hiddenCount(frames)).toBe(1);
});

test('reads ?hidden=show from an address', () => {
  expect(showingHidden('?hidden=show&group=camera')).toBe(true);
  expect(showingHidden('?group=camera')).toBe(false);
  expect(showingHidden('?hidden=yes')).toBe(false);
});
