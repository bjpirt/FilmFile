import { expect, test } from 'vitest';
import { releaseUsage } from './release-usage.ts';

test('says which to choose, with the version each gives', () => {
  expect(releaseUsage('0.3.2', { released: true })).toBe(
    'Say which: pnpm release patch (0.3.3), minor (0.4.0) or major (1.0.0).',
  );
});

test('before the first release, says each keeps the version', () => {
  expect(releaseUsage('0.1.0', { released: false })).toBe(
    'Say which: pnpm release patch, minor or major. The first release is 0.1.0, whichever is chosen.',
  );
});
