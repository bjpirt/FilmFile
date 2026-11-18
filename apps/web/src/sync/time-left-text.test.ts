import { describe, expect, test } from 'vitest';
import { timeLeftText } from './time-left-text.ts';

describe('timeLeftText', () => {
  test.each([
    [0, 'Less than a minute left'],
    [59, 'Less than a minute left'],
    [60, 'About 1 min left'],
    [5 * 60 + 20, 'About 5 min left'],
    [59 * 60 + 29, 'About 59 min left'],
    // 59.5 minutes rounds to an hour.
    [59 * 60 + 30, 'About 1 h left'],
    [2 * 3600 + 20 * 60, 'About 2 h left'],
    [2 * 3600 + 40 * 60, 'About 3 h left'],
  ])('%i seconds reads "%s"', (seconds, words) => {
    expect(timeLeftText(seconds)).toBe(words);
  });
});
