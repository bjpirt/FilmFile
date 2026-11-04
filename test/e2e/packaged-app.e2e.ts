import { expect, test } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fixtureSets } from '../../apps/backend/test/support/lab-scans.ts';
import { createRoll } from './support/journeys.ts';

// The packaged Mac app (U84), as `pnpm package` builds it, checked from
// outside: its fuses stop Playwright driving its window, so the app is
// started on a port of the journey's choosing and its UI used in a browser.
// Skipped until the app is built.

const binary = path.resolve(
  'apps/desktop/out/FilmFile-darwin-arm64/FilmFile.app/Contents/MacOS/FilmFile',
);
const origin = 'http://127.0.0.1:4313';

test.skip(!existsSync(binary), 'Build the app first with `pnpm package`.');
test.use({ baseURL: origin });

let folder = '';
let app: ChildProcess | undefined;

test.beforeEach(() => {
  folder = mkdtempSync(path.join(tmpdir(), 'filmfile-packaged-'));
  writeFileSync(
    path.join(folder, 'archive.json'),
    `${JSON.stringify({ schema: 1, id: '01JC8Y0000000000000000000E', meta: { author: 'Packaged' } }, null, 2)}\n`,
  );
});

test.afterEach(() => {
  app?.kill();
  rmSync(folder, { recursive: true, force: true });
});

async function isUp(): Promise<boolean> {
  try {
    return (await fetch(`${origin}/api/health`)).ok;
  } catch {
    return false;
  }
}

test('the packaged app runs the service, which serves the UI and makes thumbnails of scans', async ({
  page,
}) => {
  app = spawn(binary, [], {
    env: {
      ...process.env,
      FILMFILE_ARCHIVE: folder,
      FILMFILE_CACHE: path.join(folder, '.cache'),
      FILMFILE_PORT: '4313',
    },
    stdio: 'ignore',
  });
  await expect.poll(isUp, { timeout: 20_000 }).toBe(true);

  // Thumbnails are made by sharp, whose native code is outside the app archive.
  await createRoll(page, '2018-001', { scans: fixtureSets.headToTail });
  const thumbnail = page
    .getByRole('link', { name: 'Open frame 1' })
    .getByRole('img');
  await expect
    .poll(() =>
      thumbnail.evaluate((image) => {
        const width: unknown = Reflect.get(image, 'naturalWidth');
        return typeof width === 'number' ? width : 0;
      }),
    )
    .toBeGreaterThan(0);

  app.kill('SIGTERM');
  await expect.poll(isUp).toBe(false);
});
