import { execFileSync, spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';

// `pnpm release` (FF-243) run for real against a throwaway repository and its
// "GitHub" (a bare repository), with a fake gh that keeps what it's asked.

const script = path.resolve(import.meta.dirname, 'release.ts');

let root = '';
let work = '';
let origin = '';
let ghCalls = '';
let bin = '';

const gitEnv = {
  GIT_AUTHOR_NAME: 'Releaser',
  GIT_AUTHOR_EMAIL: 'releaser@example.com',
  GIT_COMMITTER_NAME: 'Releaser',
  GIT_COMMITTER_EMAIL: 'releaser@example.com',
  // The machine's own git settings (hooks, signing) stay out of it.
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_NOSYSTEM: '1',
};

function git(...args: string[]): string {
  return execFileSync('git', args, {
    cwd: work,
    env: { ...process.env, ...gitEnv },
    encoding: 'utf8',
  }).trim();
}

function commit(subject: string, file = 'notes.txt'): void {
  writeFileSync(path.join(work, file), `${subject}\n`);
  git('add', '.');
  git('commit', '--quiet', '-m', subject);
}

/** A fake gh: signed in, with any open release given by FAKE_GH_OPEN, that keeps each call as a line of JSON. */
function fakeGh(): void {
  const gh = path.join(bin, 'gh');
  writeFileSync(
    gh,
    `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
const stdin = args.includes('-') ? fs.readFileSync(0, 'utf8') : undefined;
fs.appendFileSync(${JSON.stringify(ghCalls)}, JSON.stringify({ args, stdin }) + '\\n');
if (args[0] === 'auth') process.exit(process.env.FAKE_GH_SIGNED_OUT ? 1 : 0);
if (args[0] === 'pr' && args[1] === 'list') {
  const open = process.env.FAKE_GH_OPEN;
  console.log(JSON.stringify(open ? [{ url: open }] : []));
}
if (args[0] === 'pr' && args[1] === 'create') console.log('https://github.com/bjpirt/FilmFile/pull/7');
`,
  );
  chmodSync(gh, 0o755);
}

function release(
  args: string[],
  env: Record<string, string> = {},
): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: work,
    env: {
      ...process.env,
      ...gitEnv,
      PATH: `${bin}${path.delimiter}${process.env.PATH ?? ''}`,
      ...env,
    },
    encoding: 'utf8',
  });
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

function ghArgs(): string[][] {
  return readGhCalls().map((call) => call.args);
}

function readGhCalls(): { args: string[]; stdin?: string }[] {
  if (!existsSync(ghCalls)) {
    return [];
  }
  return readFileSync(ghCalls, 'utf8')
    .trim()
    .split('\n')
    .map((line): { args: string[]; stdin?: string } => {
      const parsed: unknown = JSON.parse(line);
      const args: unknown = Reflect.get(Object(parsed), 'args');
      const stdin: unknown = Reflect.get(Object(parsed), 'stdin');
      return {
        args: Array.isArray(args) ? args.map(String) : [],
        ...(typeof stdin === 'string' ? { stdin } : {}),
      };
    });
}

function versionIn(ref: string): string {
  const json: unknown = JSON.parse(git('show', `${ref}:package.json`));
  return String(Reflect.get(Object(json), 'version'));
}

/** A repository at `version`, released as v<version> if `released`, with its main on "GitHub". */
function aRepository(version: string, { released }: { released: boolean }) {
  git('init', '--quiet', '--initial-branch=main');
  writeFileSync(
    path.join(work, 'package.json'),
    `${JSON.stringify({ name: 'filmfile', version, private: true }, null, 2)}\n`,
  );
  commit('chore: start');
  if (released) {
    git('tag', `v${version}`);
  }
  execFileSync('git', ['init', '--quiet', '--bare', origin]);
  git('remote', 'add', 'origin', origin);
}

function pushMain(): void {
  git('push', '--quiet', '--tags', 'origin', 'main');
  git('branch', '--quiet', '--set-upstream-to=origin/main');
}

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), 'filmfile-release-'));
  work = path.join(root, 'work');
  origin = path.join(root, 'origin.git');
  bin = path.join(root, 'bin');
  ghCalls = path.join(root, 'gh-calls.jsonl');
  mkdirSync(work);
  mkdirSync(bin);
  fakeGh();
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

test('prepares the release in a pull request, labelled release, and goes back to main', () => {
  aRepository('0.3.2', { released: true });
  commit('feat: events by year');
  commit('fix: keep the copyright');
  commit('docs: a note');
  pushMain();

  const result = release(['minor']);

  expect(result.stderr).toBe('');
  expect(result.status).toBe(0);
  expect(result.stdout).toContain('https://github.com/bjpirt/FilmFile/pull/7');
  expect(git('branch', '--show-current')).toBe('main');
  expect(versionIn('main')).toBe('0.3.2');
  expect(git('status', '--porcelain')).toBe('');

  const pushed = 'origin/release/0.4.0';
  git('fetch', '--quiet', 'origin');
  expect(git('log', '-1', '--format=%s', pushed)).toBe('chore: release 0.4.0');
  expect(versionIn(pushed)).toBe('0.4.0');
  const changelog = git('show', `${pushed}:CHANGELOG.md`);
  expect(changelog).toMatch(
    /^# Changelog\n\n## 0\.4\.0\n\n### Added\n\n- Events by year \(\[\w+\]\(https:\/\/github\.com\/bjpirt\/FilmFile\/commit\/\w+\)\)\n\n### Fixed\n\n- Keep the copyright /,
  );
  expect(changelog).not.toContain('A note');

  const calls = ghArgs();
  expect(calls).toContainEqual([
    'label',
    'create',
    'release',
    '--force',
    '--description',
    'A FilmFile release: merging it publishes it.',
    '--color',
    '0E8A16',
  ]);
  const created = readGhCalls().find(
    (call) => call.args[0] === 'pr' && call.args[1] === 'create',
  );
  expect(created?.args).toEqual([
    'pr',
    'create',
    '--base',
    'main',
    '--head',
    'release/0.4.0',
    '--title',
    'chore: release 0.4.0',
    '--label',
    'release',
    '--body-file',
    '-',
  ]);
  expect(created?.stdin).toMatch(/^## 0\.4\.0\n\n### Added\n/);
  expect(created?.stdin).toContain(
    'Merging this publishes FilmFile 0.4.0. Edit CHANGELOG.md in this pull request to change the notes.',
  );
  expect(calls.some((call) => call.includes('--auto'))).toBe(false);
});

test('the first release keeps the version, and says so', () => {
  aRepository('0.1.0', { released: false });
  commit('feat: rolls');
  pushMain();

  const result = release(['patch']);

  expect(result.status).toBe(0);
  git('fetch', '--quiet', 'origin');
  expect(versionIn('origin/release/0.1.0')).toBe('0.1.0');
  expect(git('show', 'origin/release/0.1.0:CHANGELOG.md')).toBe(
    '# Changelog\n\n## 0.1.0\n\nThe first release.',
  );
});

test('--dry-run says what it would do and changes nothing', () => {
  aRepository('0.3.2', { released: true });
  commit('fix: keep the copyright');
  pushMain();

  const result = release(['patch', '--dry-run']);

  expect(result.status).toBe(0);
  expect(result.stdout).toMatch(
    /^Would release 0\.3\.3 on release\/0\.3\.3:\n\n## 0\.3\.3\n\n### Fixed\n\n- Keep the copyright /,
  );
  expect(git('branch', '--list', 'release/*')).toBe('');
  expect(git('ls-remote', '--heads', 'origin', 'release/*')).toBe('');
  expect(git('status', '--porcelain')).toBe('');
  expect(
    ghArgs().filter((call) => call[0] === 'label' || call[1] === 'create'),
  ).toEqual([]);
});

test('without patch, minor or major, says how and changes nothing', () => {
  aRepository('0.3.2', { released: true });
  pushMain();

  const result = release([]);

  expect(result.status).toBe(1);
  expect(result.stderr.trim()).toBe(
    'Say which: pnpm release patch (0.3.3), minor (0.4.0) or major (1.0.0).',
  );
  expect(git('branch', '--list', 'release/*')).toBe('');
});

test.each<[string, () => void, Record<string, string>, string]>([
  [
    'uncommitted changes',
    () => {
      writeFileSync(path.join(work, 'notes.txt'), 'changed\n');
    },
    {},
    'Commit or put away your changes first.',
  ],
  [
    'a commit GitHub hasn’t got',
    () => {
      commit('feat: not pushed');
    },
    {},
    "main has 1 commit GitHub doesn't. Push it in a pull request first.",
  ],
  [
    'a release already open',
    () => undefined,
    { FAKE_GH_OPEN: 'https://github.com/bjpirt/FilmFile/pull/6' },
    'A release is already open: https://github.com/bjpirt/FilmFile/pull/6. Merge or close it first.',
  ],
  [
    'gh signed out',
    () => undefined,
    { FAKE_GH_SIGNED_OUT: '1' },
    "GitHub's gh isn't signed in. Run gh auth login, then try again.",
  ],
])('refuses with %s, changing nothing', (_case, arrange, env, message) => {
  aRepository('0.3.2', { released: true });
  commit('fix: keep the copyright');
  pushMain();
  arrange();

  const result = release(['patch'], env);

  expect(result.stderr.trim()).toBe(message);
  expect(result.status).toBe(1);
  expect(git('branch', '--list', 'release/*')).toBe('');
  expect(git('ls-remote', '--heads', 'origin', 'release/*')).toBe('');
  expect(ghArgs().filter((call) => call[1] === 'create')).toEqual([]);
});
