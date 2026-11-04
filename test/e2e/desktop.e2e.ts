import {
  _electron as electron,
  expect,
  test,
  type ElectronApplication,
} from '@playwright/test';
import { spawn } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';

// The desktop app (U82, U83): Electron starting the service and opening a
// window on it. Runs on its own folders (archives, cache and the app's
// settings), removed afterwards.

const desktop = path.resolve('apps/desktop');
// The path to Electron's binary, which the electron package exports in Node.
const electronBinary: unknown = createRequire(
  path.join(desktop, 'package.json'),
)('electron');

// Answers the app's dialogs in the journeys that choose an archive.
const dialogs = path.resolve('test/e2e/support/desktop-dialogs.ts');

let folder = '';
// Set up already, so the app opens on the Rolls page.
let archive = '';
let cache = '';
let userData = '';

test.beforeEach(() => {
  folder = mkdtempSync(path.join(tmpdir(), 'filmfile-desktop-'));
  archive = path.join(folder, 'archive');
  cache = path.join(folder, 'cache');
  userData = path.join(folder, 'user-data');
  for (const made of [archive, cache, userData]) {
    mkdirSync(made);
  }
  writeFileSync(
    path.join(archive, 'archive.json'),
    `${JSON.stringify({ schema: 1, id: '01JC8Y0000000000000000000B', meta: { author: 'Desktop' } }, null, 2)}\n`,
  );
});

test.afterEach(() => {
  rmSync(folder, { recursive: true, force: true });
});

/** The environment the app is started with: Electron as itself, not as Node.js, and these folders. */
function appEnv(extra: Record<string, string> = {}): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [name, value] of Object.entries(process.env)) {
    if (value !== undefined && name !== 'ELECTRON_RUN_AS_NODE') {
      env[name] = value;
    }
  }
  return { ...env, FILMFILE_CACHE: cache, ...extra };
}

/** The app, with no archive given, answering its dialogs as given. */
function launchChoosing(
  answers: readonly ({ choose: string } | { button: string })[],
): Promise<ElectronApplication> {
  return electron.launch({
    args: ['-r', dialogs, desktop],
    env: appEnv({
      FILMFILE_TEST_DIALOGS: JSON.stringify(answers),
      FILMFILE_TEST_USER_DATA: userData,
    }),
  });
}

/** What the app's dialogs have said so far. */
function dialogsShown(app: ElectronApplication): Promise<unknown> {
  return app.evaluate((): unknown => Reflect.get(globalThis, 'dialogsShown'));
}

function remember(chosen: string): void {
  writeFileSync(
    path.join(userData, 'settings.json'),
    JSON.stringify({ archive: chosen }),
  );
}

test('the desktop app opens FilmFile in its own window, and stops the service when it quits', async () => {
  const app = await electron.launch({
    args: [desktop],
    env: appEnv({ FILMFILE_ARCHIVE: archive }),
  });
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
  const app = await electron.launch({
    args: [desktop],
    env: appEnv({ FILMFILE_ARCHIVE: archive }),
  });
  await app.firstWindow();
  if (typeof electronBinary !== 'string') {
    throw new Error('The electron package gave no path to its binary.');
  }

  const second = spawn(electronBinary, [desktop], {
    env: appEnv({ FILMFILE_ARCHIVE: archive }),
    stdio: 'ignore',
  });
  const code = await new Promise((resolve) => second.on('exit', resolve));

  expect(code).toBe(0);
  expect(app.windows()).toHaveLength(1);
  await app.close();
});

test('on first launch the app asks where the archive is, refuses other files, and remembers the choice', async () => {
  const photos = path.join(folder, 'photos');
  mkdirSync(photos);
  writeFileSync(path.join(photos, 'holiday.jpg'), '');
  const empty = path.join(folder, 'new-archive');
  mkdirSync(empty);

  const app = await launchChoosing([
    { choose: photos },
    { button: 'Choose Again' },
    { choose: empty },
  ]);
  const window = await app.firstWindow();

  // An empty folder becomes a new archive, set up in the window as in a browser.
  await expect(
    window.getByRole('heading', { name: 'Set up your archive' }),
  ).toBeVisible();
  expect(await dialogsShown(app)).toEqual([
    { title: 'Where’s your FilmFile archive?' },
    {
      message: 'That folder isn’t a FilmFile archive.',
      detail: `${photos} has other files in it. Choose your archive, or an empty folder to start a new one.`,
    },
    { title: 'Where’s your FilmFile archive?' },
  ]);
  await app.close();

  const again = await launchChoosing([]);
  await expect(
    (await again.firstWindow()).getByRole('heading', {
      name: 'Set up your archive',
    }),
  ).toBeVisible();
  expect(await dialogsShown(again)).toEqual([]);
  await again.close();
});

test('File › Open Archive… switches to another archive, and remembers it', async () => {
  remember(archive);
  const other = path.join(folder, 'other-archive');
  mkdirSync(other);
  const app = await launchChoosing([{ choose: other }]);
  const first = await app.firstWindow();
  await expect(
    first.getByRole('heading', { level: 1, name: 'Rolls' }),
  ).toBeVisible();

  const opened = app.waitForEvent('window');
  await app.evaluate(({ Menu }) => {
    Menu.getApplicationMenu()?.getMenuItemById('open-archive')?.click();
  });

  await expect(
    (await opened).getByRole('heading', { name: 'Set up your archive' }),
  ).toBeVisible();
  expect(app.windows()).toHaveLength(1);
  expect(
    JSON.parse(readFileSync(path.join(userData, 'settings.json'), 'utf8')),
  ).toEqual({ archive: other });
  await app.close();
});

test('an archive that has gone missing is asked for again, saying where it was', async () => {
  const unplugged = path.join(folder, 'Volumes', 'Photos', 'FilmFile');
  remember(unplugged);

  const app = await launchChoosing([
    { button: 'Choose Another…' },
    { choose: archive },
  ]);

  await expect(
    (await app.firstWindow()).getByRole('heading', { level: 1, name: 'Rolls' }),
  ).toBeVisible();
  expect(await dialogsShown(app)).toEqual([
    {
      message: 'FilmFile can’t find your archive.',
      detail: `It was at ${unplugged}. If it’s on a drive that isn’t connected, connect it and try again.`,
    },
    { title: 'Where’s your FilmFile archive?' },
  ]);
  await app.close();
});
