import { expect, test } from 'vitest';
import { FixedClock } from './fixed-clock.ts';

test('always tells the time it was given', () => {
  const clock = new FixedClock('2026-11-02T12:00:00.000Z');

  expect(clock.now().toISOString()).toBe('2026-11-02T12:00:00.000Z');
  expect(clock.now().toISOString()).toBe('2026-11-02T12:00:00.000Z');
});

test('cannot be changed through a time it handed out', () => {
  const clock = new FixedClock('2026-11-02T12:00:00.000Z');

  clock.now().setFullYear(2000);

  expect(clock.now().toISOString()).toBe('2026-11-02T12:00:00.000Z');
});
