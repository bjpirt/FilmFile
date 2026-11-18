import { describe, expect, test } from 'vitest';
import { manifestAfter, planBackup } from './plan-backup.ts';

const file = (path: string, sha256 = 'a', size = 10) => ({
  path,
  size,
  sha256,
});

const roll = 'Library/rolls/2026/2026-001-AAAAAAAA';

describe('planBackup', () => {
  test('sends everything to a bucket that has nothing, by path, with their total size', () => {
    const plan = planBackup({
      library: [file('settings.json', 'x', 5), file('Library/a.json', 'y', 7)],
      manifest: [],
      mentioned: [],
    });

    expect(plan.uploads.map((f) => f.path)).toEqual([
      'Library/a.json',
      'settings.json',
    ]);
    expect(plan.bytes).toBe(12);
  });

  test('sends only what is new or has another SHA-256', () => {
    const plan = planBackup({
      library: [file('a', 'same'), file('b', 'new'), file('c', 'c')],
      manifest: [file('a', 'same'), file('b', 'old')],
      mentioned: [],
    });

    expect(plan.uploads.map((f) => f.path)).toEqual(['b', 'c']);
  });

  test('plans nothing when nothing changed', () => {
    expect(
      planBackup({
        library: [file('a')],
        manifest: [file('a')],
        mentioned: [],
      }),
    ).toEqual({
      uploads: [],
      copies: [],
      bytes: 0,
      renamed: [],
      removals: [],
      missing: [],
    });
  });

  test('copies a renamed file inside the bucket from where the bucket has it, and removes its old path', () => {
    const from = `${roll}/frames/3-BBBBBBBB/scan-CCCCCCCC/scan.tif`;
    const to = `${roll}/frames/4-BBBBBBBB/scan-CCCCCCCC/scan.tif`;

    const plan = planBackup({
      library: [file(to, 'scan', 900)],
      manifest: [file(from, 'scan', 900)],
      mentioned: [to],
    });

    expect(plan).toEqual({
      uploads: [],
      copies: [{ from, file: file(to, 'scan', 900) }],
      bytes: 0,
      renamed: [from],
      removals: [],
      missing: [],
    });
  });

  test('takes a file whose folders have the same IDs as renamed, though it changed, so a renumbered roll.json is never asked about', () => {
    const from = `${roll}/roll.json`;
    const to = 'Library/rolls/2026/2026-002-AAAAAAAA/roll.json';

    const plan = planBackup({
      library: [file(to, 'renumbered')],
      manifest: [file(from, 'before')],
      mentioned: [],
    });

    expect(plan.uploads.map((f) => f.path)).toEqual([to]);
    expect(plan.renamed).toEqual([from]);
    expect(plan.removals).toEqual([]);
  });

  test('removes, once asked, a file gone from the library that no roll.json mentions, such as one emptied from deleted/', () => {
    const emptied = file(
      'Library/deleted/2026-11-02T101500Z-frame-X/3-BBBBBBBB/scan-CCCCCCCC/scan.tif',
      'scan',
      900,
    );

    const plan = planBackup({
      library: [file('Library/a.json')],
      manifest: [file('Library/a.json'), emptied],
      mentioned: [],
    });

    expect(plan.removals).toEqual([emptied]);
    expect(plan.missing).toEqual([]);
    expect(plan.renamed).toEqual([]);
  });

  test('keeps a file a roll.json mentions that is missing on this computer, as missing', () => {
    const lost = file(
      `${roll}/frames/3-BBBBBBBB/scan-CCCCCCCC/scan.tif`,
      'scan',
    );
    const unreadable = file(
      'Library/rolls/2026/2026-009-DDDDDDDD/frames/x.jpg',
      'x',
    );

    const plan = planBackup({
      library: [],
      manifest: [lost, unreadable],
      mentioned: [lost.path, 'Library/rolls/2026/2026-009-DDDDDDDD/'],
    });

    expect(plan.missing).toEqual([lost, unreadable]);
    expect(plan.removals).toEqual([]);
  });

  test('copies a file from any path the bucket has it at, though the library still has that path too', () => {
    const plan = planBackup({
      library: [
        file('Library/one.jpg', 'same'),
        file('Library/two.jpg', 'same'),
      ],
      manifest: [file('Library/one.jpg', 'same')],
      mentioned: [],
    });

    expect(plan.copies).toEqual([
      { from: 'Library/one.jpg', file: file('Library/two.jpg', 'same') },
    ]);
    expect(plan.renamed).toEqual([]);
  });
});

describe('manifestAfter', () => {
  test('replaces what was sent, drops what was removed, and keeps the rest, by path', () => {
    expect(
      manifestAfter(
        [file('b', 'old'), file('gone'), file('kept')],
        [file('b', 'new'), file('a')],
        ['gone'],
      ),
    ).toEqual([file('a'), file('b', 'new'), file('kept')]);
  });
});
