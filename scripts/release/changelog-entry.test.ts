import { expect, test } from 'vitest';
import { changelogEntry } from './changelog-entry.ts';
import type { Commit } from './parse-commits.ts';

function commit(hash: string, subject: string, body = ''): Commit {
  return { hash, subject, body };
}

test('lists feat: under Added and fix: under Fixed, as capitalised subjects with linked hashes', () => {
  expect(
    changelogEntry('0.4.0', [
      commit(
        '293fe7f',
        "feat: the app's version, in Settings and About, with a link to GitHub (FF-194, D124)",
      ),
      commit('3bb24b8', 'fix: a sync finishes when R2 gives a weak ETag'),
      commit('8b7e870', 'feat: show how far the first sync has got'),
    ]),
  ).toBe(
    [
      '## 0.4.0',
      '',
      '### Added',
      '',
      "- The app's version, in Settings and About, with a link to GitHub (FF-194, D124) ([293fe7f](https://github.com/bjpirt/FilmFile/commit/293fe7f))",
      '- Show how far the first sync has got ([8b7e870](https://github.com/bjpirt/FilmFile/commit/8b7e870))',
      '',
      '### Fixed',
      '',
      '- A sync finishes when R2 gives a weak ETag ([3bb24b8](https://github.com/bjpirt/FilmFile/commit/3bb24b8))',
      '',
    ].join('\n'),
  );
});

test('leaves out other commits, and a heading with nothing under it', () => {
  expect(
    changelogEntry('0.3.3', [
      commit('aaaaaaa', 'docs: refine FF-243'),
      commit('bbbbbbb', 'fix: keep the copyright'),
      commit('ccccccc', 'chore: release 0.3.2'),
      commit('ddddddd', 'refactor: one lock in each roll repository'),
      commit('eeeeeee', 'Upload lab scans as versions of a frame'),
    ]),
  ).toBe(
    [
      '## 0.3.3',
      '',
      '### Fixed',
      '',
      '- Keep the copyright ([bbbbbbb](https://github.com/bjpirt/FilmFile/commit/bbbbbbb))',
      '',
    ].join('\n'),
  );
});

test('drops a scope with the prefix', () => {
  expect(
    changelogEntry('0.4.0', [commit('aaaaaaa', 'feat(sync): carry on a sync')]),
  ).toContain('- Carry on a sync ([aaaaaaa]');
});

test('puts breaking changes first, under Changed, and only there', () => {
  const entry = changelogEntry('0.4.0', [
    commit('aaaaaaa', 'feat: events by year'),
    commit('bbbbbbb', 'feat!: roll.json schema 2'),
    commit('ccccccc', 'fix(sync)!: keys kept in the keychain'),
    commit(
      'ddddddd',
      'refactor: settings in one file',
      'Moves them.\n\nBREAKING CHANGE: settings.json replaces config.json',
    ),
  ]);

  expect(entry).toBe(
    [
      '## 0.4.0',
      '',
      '### Changed',
      '',
      '- Roll.json schema 2 ([bbbbbbb](https://github.com/bjpirt/FilmFile/commit/bbbbbbb))',
      '- Keys kept in the keychain ([ccccccc](https://github.com/bjpirt/FilmFile/commit/ccccccc))',
      '- Settings in one file ([ddddddd](https://github.com/bjpirt/FilmFile/commit/ddddddd))',
      '',
      '### Added',
      '',
      '- Events by year ([aaaaaaa](https://github.com/bjpirt/FilmFile/commit/aaaaaaa))',
      '',
    ].join('\n'),
  );
});

test('with nothing a user would notice, says it was maintenance', () => {
  expect(
    changelogEntry('0.3.3', [
      commit('aaaaaaa', 'chore(deps): bump vitest'),
      commit('bbbbbbb', 'docs: a security policy'),
    ]),
  ).toBe('## 0.3.3\n\nMaintenance: dependencies and tidying.\n');
});

test('the first release says so', () => {
  expect(changelogEntry('0.1.0', 'first')).toBe(
    '## 0.1.0\n\nThe first release.\n',
  );
});
