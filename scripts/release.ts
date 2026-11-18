import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { changelogEntry } from './release/changelog-entry.ts';
import { nextVersion, type Bump } from './release/next-version.ts';
import { commitLogFormat, parseCommits } from './release/parse-commits.ts';
import { releaseDescription } from './release/release-description.ts';
import {
  releaseRefusal,
  type ReleaseFacts,
} from './release/release-refusal.ts';
import { releaseUsage } from './release/release-usage.ts';
import { withEntry } from './release/with-entry.ts';

// `pnpm release patch|minor|major [--dry-run]` (FF-243, D125): sets the next
// version in the root package.json, adds its CHANGELOG.md entry, and opens a
// pull request for it, labelled "release", on release/<version>; merging it
// publishes the release (FF-244). Everything is checked before anything
// changes. Run from the repository's root, as pnpm runs it.

/** Runs a command, giving its output; a failure is a bug, or a machine to fix, and throws. */
function run(command: string, args: readonly string[], input?: string): string {
  return execFileSync(command, args, {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'inherit'],
    ...(input === undefined ? {} : { input }),
  }).trim();
}

function succeeds(command: string, args: readonly string[]): boolean {
  return spawnSync(command, args, { stdio: 'ignore' }).status === 0;
}

function refuse(message: string): never {
  console.error(message);
  process.exit(1);
}

function readVersion(): string {
  const parsed: unknown = JSON.parse(readFileSync('package.json', 'utf8'));
  const version: unknown = Reflect.get(Object(parsed), 'version');
  if (typeof version !== 'string') {
    throw new Error('The root package.json has no version.');
  }
  return version;
}

function writeVersion(version: string): void {
  const parsed: unknown = JSON.parse(readFileSync('package.json', 'utf8'));
  // Kept as Prettier formats package.json: two spaces, keys in their order.
  writeFileSync(
    'package.json',
    `${JSON.stringify({ ...Object(parsed), version }, null, 2)}\n`,
  );
}

function ghState(): ReleaseFacts['gh'] {
  const status = spawnSync('gh', ['auth', 'status'], { stdio: 'ignore' });
  if (status.error !== undefined) {
    return 'missing';
  }
  return status.status === 0 ? 'ready' : 'signed-out';
}

function openRelease(): string | undefined {
  const open: unknown = JSON.parse(
    run('gh', [
      'pr',
      'list',
      '--label',
      'release',
      '--state',
      'open',
      '--json',
      'url',
      '--limit',
      '1',
    ]),
  );
  const url: unknown = Array.isArray(open)
    ? Reflect.get(Object(open[0]), 'url')
    : undefined;
  return typeof url === 'string' ? url : undefined;
}

function isBump(word: string | undefined): word is Bump {
  return word === 'patch' || word === 'minor' || word === 'major';
}

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const words = args.filter((arg) => arg !== '--dry-run');
const current = readVersion();
const tags = run('git', ['tag', '--list', 'v*'])
  .split('\n')
  .filter((tag) => tag !== '');
const released = tags.length > 0;

const [bump] = words;
if (words.length !== 1 || !isBump(bump)) {
  refuse(releaseUsage(current, { released }));
}
const next = nextVersion(current, bump, { released });
const branch = `release/${next}`;

const gh = ghState();
run('git', ['fetch', '--quiet', '--tags', 'origin', 'main']);
const [behind = 0, ahead = 0] = run('git', [
  'rev-list',
  '--left-right',
  '--count',
  'origin/main...HEAD',
])
  .split(/\s+/)
  .map(Number);
const problem = releaseRefusal({
  gh,
  branch: run('git', ['branch', '--show-current']),
  uncommitted: run('git', ['status', '--porcelain']) !== '',
  behind,
  ahead,
  current,
  currentReleased: tags.includes(`v${current}`),
  anyReleased: released,
  next,
  openRelease: gh === 'ready' ? openRelease() : undefined,
  branchExists:
    succeeds('git', [
      'rev-parse',
      '--verify',
      '--quiet',
      `refs/heads/${branch}`,
    ]) || run('git', ['ls-remote', '--heads', 'origin', branch]) !== '',
});
if (problem !== undefined) {
  refuse(problem);
}

const entry = released
  ? changelogEntry(
      next,
      parseCommits(
        run('git', [
          'log',
          `--format=${commitLogFormat}`,
          `${run('git', ['describe', '--tags', '--abbrev=0', '--match', 'v*'])}..HEAD`,
        ]),
      ),
    )
  : changelogEntry(next, 'first');

if (dryRun) {
  console.log(`Would release ${next} on ${branch}:\n\n${entry}`);
  process.exit(0);
}

run('git', ['switch', '--quiet', '--create', branch]);
writeVersion(next);
writeFileSync(
  'CHANGELOG.md',
  withEntry(
    existsSync('CHANGELOG.md')
      ? readFileSync('CHANGELOG.md', 'utf8')
      : undefined,
    entry,
  ),
);
run('git', ['add', 'package.json', 'CHANGELOG.md']);
run('git', ['commit', '--quiet', '--message', `chore: release ${next}`]);
run('git', ['push', '--quiet', '--set-upstream', 'origin', branch]);
run('gh', [
  'label',
  'create',
  'release',
  '--force',
  '--description',
  'A FilmFile release: merging it publishes it.',
  '--color',
  '0E8A16',
]);
const url = run(
  'gh',
  [
    'pr',
    'create',
    '--base',
    'main',
    '--head',
    branch,
    '--title',
    `chore: release ${next}`,
    '--label',
    'release',
    '--body-file',
    '-',
  ],
  releaseDescription(next, entry),
);
run('git', ['switch', '--quiet', 'main']);
console.log(
  `Opened the release of ${next}: ${url}\nMerging it publishes the release.`,
);
