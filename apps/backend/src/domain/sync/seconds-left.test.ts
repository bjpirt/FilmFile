import { describe, expect, test } from 'vitest';
import { secondsLeft } from './seconds-left.ts';

const minute = 60_000;

describe('secondsLeft', () => {
  test('is null until a minute has been timed', () => {
    expect(
      secondsLeft({
        samples: [
          { at: 0, bytes: 0 },
          { at: 30_000, bytes: 1000 },
        ],
        now: minute - 1,
        remaining: 5000,
      }),
    ).toBeNull();
  });

  test('is the remaining bytes at the speed since the newest sample a minute old', () => {
    expect(
      secondsLeft({
        // 6,000 bytes in the minute from 30 s to 90 s: 100 a second.
        samples: [
          { at: 0, bytes: 0 },
          { at: 30_000, bytes: 50_000 },
          { at: 85_000, bytes: 55_000 },
          { at: 88_000, bytes: 56_000 },
        ],
        now: 90_000 + 10_000,
        remaining: 12_000,
      }),
    ).toBe(Math.ceil(12_000 / (6000 / 70)));
  });

  test('is zero with nothing left, and null while nothing moves', () => {
    const samples = [
      { at: 0, bytes: 0 },
      { at: 70_000, bytes: 0 },
    ];
    expect(secondsLeft({ samples, now: 2 * minute, remaining: 0 })).toBe(0);
    expect(secondsLeft({ samples, now: 2 * minute, remaining: 10 })).toBeNull();
  });

  test('is null with no samples', () => {
    expect(secondsLeft({ samples: [], now: minute, remaining: 10 })).toBeNull();
  });
});
