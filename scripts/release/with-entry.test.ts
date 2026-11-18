import { expect, test } from 'vitest';
import { withEntry } from './with-entry.ts';

const entry = '## 0.4.0\n\n### Fixed\n\n- A fix\n';

test('puts the entry at the top, under the title', () => {
  expect(
    withEntry('# Changelog\n\n## 0.3.2\n\nThe first release.\n', entry),
  ).toBe(
    '# Changelog\n\n## 0.4.0\n\n### Fixed\n\n- A fix\n\n## 0.3.2\n\nThe first release.\n',
  );
});

test('makes the changelog when there is none', () => {
  expect(withEntry(undefined, entry)).toBe(`# Changelog\n\n${entry}`);
});
