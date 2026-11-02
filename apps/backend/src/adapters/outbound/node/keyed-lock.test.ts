import { expect, test } from 'vitest';
import { KeyedLock } from './keyed-lock.ts';

function deferred() {
  let release: () => void = () => undefined;
  const done = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { done, release };
}

test('runs work for the same key one at a time, in order', async () => {
  const lock = new KeyedLock();
  const events: string[] = [];
  const first = deferred();

  const a = lock.run('roll', async () => {
    events.push('a starts');
    await first.done;
    events.push('a ends');
  });
  const b = lock.run('roll', () => {
    events.push('b runs');
    return Promise.resolve();
  });
  await Promise.resolve();
  first.release();
  await Promise.all([a, b]);

  expect(events).toEqual(['a starts', 'a ends', 'b runs']);
});

test('runs work for different keys at the same time', async () => {
  const lock = new KeyedLock();
  const events: string[] = [];
  const first = deferred();

  const a = lock.run('one', async () => {
    await first.done;
    events.push('one ends');
  });
  await lock.run('two', () => {
    events.push('two runs');
    return Promise.resolve();
  });
  first.release();
  await a;

  expect(events).toEqual(['two runs', 'one ends']);
});

test('keeps going after work fails, and passes the failure on', async () => {
  const lock = new KeyedLock();

  await expect(
    lock.run('roll', () => Promise.reject(new Error('disk full'))),
  ).rejects.toThrow('disk full');

  expect(await lock.run('roll', () => Promise.resolve('next'))).toBe('next');
});
