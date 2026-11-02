import { describe, expect, test } from 'vitest';
import { folderName, newIdWithUniqueFolder } from './folder-names.ts';

describe('folderName', () => {
  test('is the last eight characters of the ID', () => {
    expect(folderName('01M6E883WPQ8WWY3PV27PMRVD6')).toBe('27PMRVD6');
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
