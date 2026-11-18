import { expect, test } from 'vitest';
import { releaseNotes } from './release-notes.ts';

const changelog = [
  '# Changelog',
  '',
  '## 0.4.0',
  '',
  '### Added',
  '',
  '- Events by year ([aaaaaaa](https://github.com/bjpirt/FilmFile/commit/aaaaaaa))',
  '',
  '## 0.3.2',
  '',
  '### Fixed',
  '',
  '- Keep the copyright ([bbbbbbb](https://github.com/bjpirt/FilmFile/commit/bbbbbbb))',
  '',
].join('\n');

const installing = (version: string) =>
  [
    '### Installing',
    '',
    'Download the disk image for your Mac (Apple menu › About This Mac shows its chip):',
    '',
    `- Apple silicon (M1 or later): FilmFile-${version}-mac-arm64.dmg`,
    `- Intel: FilmFile-${version}-mac-x64.dmg`,
    '',
    'Needs macOS 12 Monterey or later.',
    '',
    'Open the disk image and drag FilmFile to Applications. The app isn’t signed yet, so the first time macOS won’t open it: choose Done, then System Settings › Privacy & Security › Open Anyway.',
    '',
    'Check the download with `shasum -a 256 -c SHA256SUMS`, in the folder holding it and SHA256SUMS.',
    '',
  ].join('\n');

test('are the version’s entry without its heading, then how to install it', () => {
  expect(releaseNotes(changelog, '0.4.0')).toBe(
    [
      '### Added',
      '',
      '- Events by year ([aaaaaaa](https://github.com/bjpirt/FilmFile/commit/aaaaaaa))',
      '',
      installing('0.4.0'),
    ].join('\n'),
  );
});

test('take only that version’s entry, the last one included', () => {
  expect(releaseNotes(changelog, '0.3.2')).toBe(
    [
      '### Fixed',
      '',
      '- Keep the copyright ([bbbbbbb](https://github.com/bjpirt/FilmFile/commit/bbbbbbb))',
      '',
      installing('0.3.2'),
    ].join('\n'),
  );
});

test('the first release', () => {
  expect(
    releaseNotes('# Changelog\n\n## 0.1.0\n\nThe first release.\n', '0.1.0'),
  ).toBe(`The first release.\n\n${installing('0.1.0')}`);
});

test('none when the changelog has no entry for the version', () => {
  expect(releaseNotes(changelog, '0.5.0')).toBeUndefined();
  expect(releaseNotes(changelog, '0.4')).toBeUndefined();
  expect(releaseNotes(undefined, '0.4.0')).toBeUndefined();
});
