import { expect, test } from 'vitest';
import { releaseRefusal, type ReleaseFacts } from './release-refusal.ts';

const ready: ReleaseFacts = {
  gh: 'ready',
  branch: 'main',
  uncommitted: false,
  behind: 0,
  ahead: 0,
  current: '0.3.2',
  currentReleased: true,
  anyReleased: true,
  next: '0.4.0',
  openRelease: undefined,
  branchExists: false,
};

test('nothing in the way', () => {
  expect(releaseRefusal(ready)).toBeUndefined();
});

test.each<[string, Partial<ReleaseFacts>, string]>([
  [
    'gh missing',
    { gh: 'missing' },
    "GitHub's gh isn't installed. Install it from https://cli.github.com, then try again.",
  ],
  [
    'gh signed out',
    { gh: 'signed-out' },
    "GitHub's gh isn't signed in. Run gh auth login, then try again.",
  ],
  ['another branch', { branch: 'ff-243' }, 'Run it on main.'],
  [
    'uncommitted changes',
    { uncommitted: true },
    'Commit or put away your changes first.',
  ],
  [
    'behind',
    { behind: 2 },
    "main is 2 commits behind GitHub's. Run git pull first.",
  ],
  [
    'one behind',
    { behind: 1 },
    "main is 1 commit behind GitHub's. Run git pull first.",
  ],
  [
    'ahead',
    { ahead: 1 },
    "main has 1 commit GitHub doesn't. Push it in a pull request first.",
  ],
  [
    'two ahead',
    { ahead: 2 },
    "main has 2 commits GitHub doesn't. Push it in a pull request first.",
  ],
  [
    'a version not yet published',
    { current: '0.4.0', currentReleased: false },
    "0.4.0 hasn't been published yet. Run the Release workflow on main to publish it.",
  ],
  [
    'a release already open',
    { openRelease: 'https://github.com/bjpirt/FilmFile/pull/42' },
    'A release is already open: https://github.com/bjpirt/FilmFile/pull/42. Merge or close it first.',
  ],
  [
    'the branch already there',
    { branchExists: true },
    'There is already a branch release/0.4.0. Delete it, or finish the release it holds.',
  ],
])('refuses with %s', (_case, facts, message) => {
  expect(releaseRefusal({ ...ready, ...facts })).toBe(message);
});

test('the first release, with no tag yet, is not waiting to be published', () => {
  expect(
    releaseRefusal({
      ...ready,
      current: '0.1.0',
      currentReleased: false,
      anyReleased: false,
      next: '0.1.0',
    }),
  ).toBeUndefined();
});
