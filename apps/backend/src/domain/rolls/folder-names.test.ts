import { describe, expect, test } from 'vitest';
import {
  folderName,
  frameFolderName,
  newIdWithUniqueFolder,
  versionFolderName,
} from './folder-names.ts';

describe('folderName', () => {
  test('is the last eight characters of the ID', () => {
    expect(folderName('01M6E883WPQ8WWY3PV27PMRVD6')).toBe('27PMRVD6');
  });
});

describe('frameFolderName', () => {
  test.each([
    ['14-15', '14-15'],
    ['12/13', '12_13'],
    ['.12', '_12'],
    ['-12', '_-12'],
    [null, 'unnumbered'],
  ] as const)('names %s as %s with its ID', (number, label) => {
    expect(frameFolderName(number, '01M6E883WPQ8WWY3PV27PMRVD6')).toBe(
      `${label}-27PMRVD6`,
    );
  });
});

describe('versionFolderName', () => {
  test('names a version by kind and the end of its ID', () => {
    expect(versionFolderName('raw-scan', '01M6E883WPQ8WWY3PV27PMRVD6')).toBe(
      'raw-scan-27PMRVD6',
    );
  });
});

describe('newIdWithUniqueFolder', () => {
  function sequence(...ids: string[]): () => string {
    return () => ids.shift() ?? 'EXHAUSTED';
  }

  test('returns the first ID when its folder name is free', () => {
    const id = newIdWithUniqueFolder(
      ['01M6E883WPAAAAAAAA11111111'],
      sequence('01M6E883WPBBBBBBBB22222222'),
    );

    expect(id).toBe('01M6E883WPBBBBBBBB22222222');
  });

  test('skips IDs whose folder name is already taken in the parent', () => {
    const id = newIdWithUniqueFolder(
      ['01M6E883WPAAAAAAAA11111111'],
      sequence('01M6E883WPBBBBBBBB11111111', '01M6E883WPCCCCCCCC33333333'),
    );

    expect(id).toBe('01M6E883WPCCCCCCCC33333333');
  });
});
