import { expect, test } from 'vitest';
import { issueFor } from './issue-for.ts';

const refused = {
  error: 'invalid request',
  issues: [
    { path: ['publish', 'bucket'], message: 'must be lower-case' },
    { path: ['publish', 'address'], message: 'must be an https:// address' },
  ],
};

test('finds the message for a path', () => {
  expect(issueFor(refused, ['publish', 'address'])).toBe(
    'must be an https:// address',
  );
});

test.each([
  ['a path with no issue', refused, ['name']],
  ['no issues', { error: 'x' }, ['publish', 'bucket']],
  ['issues that are not a list', { issues: 'x' }, ['publish', 'bucket']],
  ['nothing', undefined, ['publish', 'bucket']],
])('finds nothing for %s', (_name, error, path) => {
  expect(issueFor(error, path)).toBeUndefined();
});
