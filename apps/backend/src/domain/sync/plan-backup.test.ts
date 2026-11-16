import { describe, expect, test } from 'vitest';
import { manifestAfter, planBackup } from './plan-backup.ts';

const file = (path: string, sha256 = 'a', size = 10) => ({
  path,
  size,
  sha256,
});

describe('planBackup', () => {
  test('sends everything to a bucket that has nothing, by path, with their total size', () => {
    const plan = planBackup({
      library: [file('settings.json', 'x', 5), file('Library/a.json', 'y', 7)],
      manifest: [],
    });

    expect(plan.uploads.map((f) => f.path)).toEqual([
      'Library/a.json',
      'settings.json',
    ]);
    expect(plan.bytes).toBe(12);
  });

  test('sends only what is new or has another SHA-256', () => {
    const plan = planBackup({
      library: [file('a', 'same'), file('b', 'new'), file('c')],
      manifest: [file('a', 'same'), file('b', 'old')],
    });

    expect(plan.uploads.map((f) => f.path)).toEqual(['b', 'c']);
  });

  test('sends nothing when nothing changed', () => {
    expect(
      planBackup({ library: [file('a')], manifest: [file('a'), file('gone')] }),
    ).toEqual({ uploads: [], bytes: 0 });
  });
});

describe('manifestAfter', () => {
  test('replaces what was sent, keeps the rest, by path', () => {
    expect(
      manifestAfter(
        [file('b', 'old'), file('gone')],
        [file('b', 'new'), file('a')],
      ),
    ).toEqual([file('a'), file('b', 'new'), file('gone')]);
  });
});
