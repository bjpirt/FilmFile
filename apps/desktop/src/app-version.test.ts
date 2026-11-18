import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { appVersion } from './app-version.ts';

let folder = '';

afterEach(() => {
  rmSync(folder, { recursive: true, force: true });
});

test('run from source, reads the version from the package.json and says so', () => {
  folder = mkdtempSync(path.join(tmpdir(), 'filmfile-version-'));
  const file = path.join(folder, 'package.json');
  writeFileSync(file, JSON.stringify({ name: 'filmfile', version: '1.2.3' }));

  expect(appVersion(undefined, file)).toEqual({ version: '1.2.3', dev: true });
});

test('bundled, gives the version it was built with, unmarked', () => {
  expect(appVersion('0.4.0', path.join(tmpdir(), 'missing.json'))).toEqual({
    version: '0.4.0',
    dev: false,
  });
});

test('from source by default, at the root package.json', () => {
  expect(appVersion()).toMatchObject({ dev: true });
});
