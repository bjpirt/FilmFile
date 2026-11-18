import { describe, expect, test } from 'vitest';
import { firstSyncFigure } from './backup-figure.ts';

describe('firstSyncFigure', () => {
  test('counts the library’s files in the bucket at the same path and size', () => {
    expect(
      firstSyncFigure({
        library: [
          { path: 'Library/a.jpg', size: 100 },
          { path: 'Library/b.jpg', size: 200 },
          { path: 'Library/c.jpg', size: 300 },
          { path: 'settings.json', size: 10 },
        ],
        listing: [
          { key: 'Library/a.jpg', size: 100, md5: 'x' },
          // Cut short, or changed since: not counted.
          { key: 'Library/b.jpg', size: 150, md5: 'x' },
          { key: 'settings.json', size: 10, md5: 'x' },
          { key: 'filmfile/sync.json', size: 90, md5: 'x' },
        ],
      }),
    ).toEqual({ bytes: 610, files: 4, bytesBackedUp: 110, filesBackedUp: 2 });
  });

  test('an empty library is all backed up', () => {
    expect(firstSyncFigure({ library: [], listing: [] })).toEqual({
      bytes: 0,
      files: 0,
      bytesBackedUp: 0,
      filesBackedUp: 0,
    });
  });
});
