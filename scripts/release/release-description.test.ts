import { expect, test } from 'vitest';
import { releaseDescription } from './release-description.ts';

test('is the entry, then what merging does', () => {
  expect(releaseDescription('0.4.0', '## 0.4.0\n\nThe first release.\n')).toBe(
    '## 0.4.0\n\nThe first release.\n\n---\n\nMerging this publishes FilmFile 0.4.0. Edit CHANGELOG.md in this pull request to change the notes.\n',
  );
});
