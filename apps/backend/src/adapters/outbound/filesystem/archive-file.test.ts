import { describe, expect, test } from 'vitest';
import { isArchiveId } from '../../../domain/shared/ids.ts';
import { archiveFileContent, parseArchiveFile } from './archive-file.ts';

const id = '01JC8Y0000000000000000000A';
if (!isArchiveId(id)) {
  throw new Error(`bad test data: ${id}`);
}

describe('archive.json', () => {
  test('keeps author and copyright in meta, and only those it has', () => {
    const text = archiveFileContent({
      id,
      name: 'Ben’s film archive',
      author: 'Ben Pirt',
      copyright: null,
    });

    expect(JSON.parse(text)).toEqual({
      schema: 1,
      id,
      name: 'Ben’s film archive',
      meta: { author: 'Ben Pirt' },
    });
  });

  test('reads a file with no meta as having no author or copyright', () => {
    expect(
      parseArchiveFile(JSON.stringify({ schema: 1, id, name: 'Film' })),
    ).toEqual({ id, name: 'Film', author: null, copyright: null });
  });

  test('refuses a file without a name', () => {
    expect(() =>
      parseArchiveFile(JSON.stringify({ schema: 1, id, name: '' })),
    ).toThrow();
  });
});
