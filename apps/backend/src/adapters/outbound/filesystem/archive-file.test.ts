import { describe, expect, test } from 'vitest';
import { isArchiveId } from '../../../domain/shared/ids.ts';
import { archiveFileContent, parseArchiveFile } from './archive-file.ts';

const id = '01JC8Y0000000000000000000A';
if (!isArchiveId(id)) {
  throw new Error(`bad test data: ${id}`);
}

describe('archive.json', () => {
  test('keeps the author and copyright in meta, and no copyright it hasn’t', () => {
    const text = archiveFileContent({
      id,
      author: 'Ben Pirt',
      copyright: null,
    });

    expect(JSON.parse(text)).toEqual({
      schema: 1,
      id,
      meta: { author: 'Ben Pirt' },
    });
  });

  test('ignores a name written before archives had none (D44)', () => {
    expect(
      parseArchiveFile(
        JSON.stringify({
          schema: 1,
          id,
          name: 'Film Archive',
          meta: { author: 'Ben Pirt', copyright: '© Ben Pirt' },
        }),
      ),
    ).toEqual({ id, author: 'Ben Pirt', copyright: '© Ben Pirt' });
  });

  test('refuses a file without an author', () => {
    expect(() =>
      parseArchiveFile(JSON.stringify({ schema: 1, id, meta: {} })),
    ).toThrow();
  });
});
