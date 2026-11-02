import { expect, test } from 'vitest';
import { NodeClock } from './node-clock.ts';

test('tells the current time', () => {
  const before = Date.now();

  const now = new NodeClock().now().getTime();

  expect(now).toBeGreaterThanOrEqual(before);
  expect(now).toBeLessThanOrEqual(Date.now());
});
