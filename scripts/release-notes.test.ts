import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';

// `node scripts/release-notes.ts <version>`, as the Release workflow runs it (FF-244).

const script = path.resolve(import.meta.dirname, 'release-notes.ts');
let folder = '';

beforeEach(() => {
  folder = mkdtempSync(path.join(tmpdir(), 'filmfile-notes-'));
});

afterEach(() => {
  rmSync(folder, { recursive: true, force: true });
});

function notes(version: string) {
  return spawnSync(process.execPath, [script, version], {
    cwd: folder,
    encoding: 'utf8',
  });
}

test('prints the notes for the version', () => {
  writeFileSync(
    path.join(folder, 'CHANGELOG.md'),
    '# Changelog\n\n## 0.1.0\n\nThe first release.\n',
  );

  const result = notes('0.1.0');

  expect(result.status).toBe(0);
  expect(result.stdout).toMatch(/^The first release\.\n\n### Installing\n/);
});

test('fails, saying so, when the changelog has no entry for the version', () => {
  writeFileSync(
    path.join(folder, 'CHANGELOG.md'),
    '# Changelog\n\n## 0.1.0\n\nThe first release.\n',
  );

  const result = notes('0.4.0');

  expect(result.status).toBe(1);
  expect(result.stdout).toBe('');
  expect(result.stderr.trim()).toBe(
    'CHANGELOG.md has no entry for 0.4.0. Prepare releases with pnpm release.',
  );
});

test('fails the same way with no changelog at all', () => {
  const result = notes('0.1.0');

  expect(result.status).toBe(1);
  expect(result.stderr.trim()).toBe(
    'CHANGELOG.md has no entry for 0.1.0. Prepare releases with pnpm release.',
  );
});
