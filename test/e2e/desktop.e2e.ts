import { _electron as electron, expect, test } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';

// The desktop app (U82): Electron starting the service and opening a window
// on it. Runs on its own archive and cache, removed afterwards.

const desktop = path.resolve('apps/desktop');
// The path to Electron's binary, which the electron package exports in Node.
const electronBinary: unknown = createRequire(
  path.join(desktop, 'package.json'),
)('electron');

let archive = '';
let cache = '';

test.beforeEach(() => {
  archive = mkdtempSync(path.join(tmpdir(), 'filmfile-desktop-archive-'));
  cache = mkdtempSync(path.join(tmpdir(), 'filmfile-desktop-cache-'));
  writeFileSync(
    path.join(archive, 'archive.json'),
    `${JSON.stringify({ schema: 1, id: '01JC8Y0000000000000000000B', meta: { author: 'Desktop' } }, null, 2)}\n`,
  );
});

test.afterEach(() => {
  rmSync(archive, { recursive: true, force: true });
  rmSync(cache, { recursive: true, force: true });
});

/** The environment the app is started with: this archive, and Electron as itself, not as Node.js. */
function appEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [name, value] of Object.entries(process.env)) {
    if (value !== undefined && name !== 'ELECTRON_RUN_AS_NODE') {
      env[name] = value;
    }
  }
  return { ...env, FILMFILE_ARCHIVE: archive, FILMFILE_CACHE: cache };
}

test('the desktop app opens FilmFile in its own window, and stops the service when it quits', async () => {
  const app = await electron.launch({ args: [desktop], env: appEnv() });
  const window = await app.firstWindow();

  await expect(
    window.getByRole('heading', { level: 1, name: 'Rolls' }),
  ).toBeVisible();
  await expect(window).toHaveTitle('FilmFile');

  // The page is only a web page: no Node.js, and no new windows.
  expect(await window.evaluate(() => 'require' in globalThis)).toBe(false);
  // As a string: the tests are typed without the browser's globals.
  expect(await window.evaluate("window.open('about:blank') === null")).toBe(
    true,
  );

  const service = new URL(window.url()).origin;
  expect((await fetch(`${service}/api/health`)).ok).toBe(true);
  await app.close();
  await expect(fetch(`${service}/api/health`)).rejects.toThrow();
});

test('opening the app again while it’s open starts no second copy', async () => {
  const app = await electron.launch({ args: [desktop], env: appEnv() });
  await app.firstWindow();
  if (typeof electronBinary !== 'string') {
    throw new Error('The electron package gave no path to its binary.');
  }

  const second = spawn(electronBinary, [desktop], {
    env: appEnv(),
    stdio: 'ignore',
  });
  const code = await new Promise((resolve) => second.on('exit', resolve));

  expect(code).toBe(0);
  expect(app.windows()).toHaveLength(1);
  await app.close();
});
