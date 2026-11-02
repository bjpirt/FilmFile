import { expect, test } from 'vitest';
import { aRoll, labScanFrames } from './builders.ts';

test('a roll of lab scans has a numbered frame per scan, each with its own file', () => {
  const roll = aRoll({ frames: labScanFrames(36) });

  expect(roll.frames.map((f) => f.number)).toEqual(
    Array.from({ length: 36 }, (_, i) => String(i + 1)),
  );
  expect(roll.frames[13]?.versions[0]?.file).toMatch(/\/12340014\.jpg$/);
  expect(new Set(roll.frames.map((f) => f.versions[0]?.sha256)).size).toBe(36);
});
