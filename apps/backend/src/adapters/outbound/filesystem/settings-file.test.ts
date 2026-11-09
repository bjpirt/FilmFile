import { describe, expect, test } from 'vitest';
import { isArchiveId } from '../../../domain/shared/ids.ts';
import { settingsFileContent, parseSettingsFile } from './settings-file.ts';

const id = '01JC8Y0000000000000000000A';
if (!isArchiveId(id)) {
  throw new Error(`bad test data: ${id}`);
}

describe('settings.json', () => {
  test('keeps the author and copyright in meta, and no copyright it hasn’t', () => {
    const text = settingsFileContent({
      id,
      author: 'Ben Pirt',
      copyright: null,
      rollNumberPattern: '{year}-{n:3}',
    });

    expect(JSON.parse(text)).toEqual({
      schema: 1,
      id,
      meta: { author: 'Ben Pirt' },
    });
  });

  test('ignores a name written before archives had none (D44)', () => {
    expect(
      parseSettingsFile(
        JSON.stringify({
          schema: 1,
          id,
          name: 'Film Archive',
          meta: { author: 'Ben Pirt', copyright: '© Ben Pirt' },
        }),
      ),
    ).toEqual({
      id,
      author: 'Ben Pirt',
      copyright: '© Ben Pirt',
      rollNumberPattern: '{year}-{n:3}',
    });
  });

  test('keeps a chosen roll number pattern, and the default when a file has none (D88)', () => {
    const settings = {
      id,
      author: 'Ben Pirt',
      copyright: null,
      rollNumberPattern: 'BP-{year}-{n:2}',
    };

    const text = settingsFileContent(settings);

    expect(JSON.parse(text)).toMatchObject({
      rollNumberPattern: 'BP-{year}-{n:2}',
    });
    expect(parseSettingsFile(text)).toEqual(settings);
  });

  test('refuses a file without an author', () => {
    expect(() =>
      parseSettingsFile(JSON.stringify({ schema: 1, id, meta: {} })),
    ).toThrow();
  });
});
