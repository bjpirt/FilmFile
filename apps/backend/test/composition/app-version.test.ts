import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { appVersion } from '../../src/composition/app-version.ts';

let folder = '';

afterEach(() => {
  rmSync(folder, { recursive: true, force: true });
});

function aPackageJson(contents: object): string {
  folder = mkdtempSync(path.join(tmpdir(), 'filmfile-version-'));
  const file = path.join(folder, 'package.json');
  writeFileSync(file, JSON.stringify(contents));
  return file;
}

test('run from source, reads the version from the package.json and says so', () => {
  const file = aPackageJson({ name: 'filmfile', version: '1.2.3' });

  expect(appVersion(undefined, file)).toEqual({ version: '1.2.3', dev: true });
});

test('bundled, gives the version it was built with, unmarked, without reading the package.json', () => {
  expect(appVersion('0.4.0', path.join(tmpdir(), 'missing.json'))).toEqual({
    version: '0.4.0',
    dev: false,
  });
});

test('a package.json without a version is a bug, and throws', () => {
  const file = aPackageJson({ name: 'filmfile' });

  expect(() => appVersion(undefined, file)).toThrow();
});
