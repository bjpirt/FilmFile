import { expect, test } from 'vitest';
import { parseCommits } from './parse-commits.ts';

test('reads commits from git log in its format, bodies and all', () => {
  const log =
    'abc1234\x1ffeat: one\x1f\x1e\n' +
    'def5678\x1ffix: two\x1fA body.\n\nBREAKING CHANGE: it moved\n\x1e\n';

  expect(parseCommits(log)).toEqual([
    { hash: 'abc1234', subject: 'feat: one', body: '' },
    {
      hash: 'def5678',
      subject: 'fix: two',
      body: 'A body.\n\nBREAKING CHANGE: it moved',
    },
  ]);
});

test('no commits, no output', () => {
  expect(parseCommits('')).toEqual([]);
});
