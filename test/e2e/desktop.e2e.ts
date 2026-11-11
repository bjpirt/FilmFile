import {
  _electron as electron,
  expect,
  test,
  type ElectronApplication,
} from '@playwright/test';
import { spawn } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { aJpeg } from '../../apps/backend/test/support/a-jpeg.ts';
import { tmpdir } from 'node:os';
import path from 'node:path';

// The desktop app (U82, FF-105): Electron starting the service and opening a
// window on it, on a FilmFile folder. Runs on its own folders (FilmFile
// folders, cache and the app's settings), removed afterwards.

const desktop = path.resolve('apps/desktop');
// The path to Electron's binary, which the electron package exports in Node.
const electronBinary: unknown = createRequire(
  path.join(desktop, 'package.json'),
)('electron');

// Answers the app's dialogs in the journeys that choose a folder.
const dialogs = path.resolve('test/e2e/support/desktop-dialogs.ts');

let root = '';
// A FilmFile folder with its library set up, so the app opens on the Rolls page.
let filmFile = '';
let cache = '';
let userData = '';

test.beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), 'filmfile-desktop-'));
  filmFile = path.join(root, 'FilmFile');
  cache = path.join(root, 'cache');
  userData = path.join(root, 'user-data');
  for (const made of [
    filmFile,
    path.join(filmFile, 'Library'),
    cache,
    userData,
  ]) {
    mkdirSync(made);
  }
  writeFileSync(
    path.join(filmFile, 'settings.json'),
    `${JSON.stringify({ schema: 1, id: '01JC8Y0000000000000000000B', meta: { author: 'Desktop' } }, null, 2)}\n`,
  );
});

test.afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

/** A new folder in the journey's own, with the files given. */
function folderWith(name: string, files: readonly string[] = []): string {
  const made = path.join(root, name);
  mkdirSync(made);
  for (const file of files) {
    writeFileSync(path.join(made, file), '');
  }
  return made;
}

/** The environment the app is started with: Electron as itself, not as Node.js, and these folders. */
function appEnv(extra: Record<string, string> = {}): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [name, value] of Object.entries(process.env)) {
    if (
      value !== undefined &&
      name !== 'ELECTRON_RUN_AS_NODE' &&
      name !== 'FILMFILE_FOLDER'
    ) {
      env[name] = value;
    }
  }
  return { ...env, FILMFILE_CACHE: cache, ...extra };
}

type Answer =
  { choose: string } | { cancel: true } | { button: string } | { save: string };

/** The app, with no folder given, answering its dialogs as given. */
function launchChoosing(
  answers: readonly Answer[],
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
    JSON.stringify({ folder: chosen }),
  );
}

function remembered(): unknown {
  return JSON.parse(readFileSync(path.join(userData, 'settings.json'), 'utf8'));
}

const welcome = {
  message: 'Welcome to FilmFile',
  detail:
    'FilmFile keeps your library, and everything made from it, in one folder. Choose where.',
};
const chooser = { title: 'Where should FilmFile keep its files?' };

function notFilmFileFolder(folder: string) {
  return {
    message: 'That isn’t a FilmFile folder.',
    detail: `${folder} has other files in it and no Library. Choose your FilmFile folder, or an empty folder to start a new one.`,
  };
}

test('the desktop app opens FilmFile in its own window, and stops the service when it quits', async () => {
  const app = await electron.launch({
    args: [desktop],
    env: appEnv({ FILMFILE_FOLDER: filmFile }),
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
    env: appEnv({ FILMFILE_FOLDER: filmFile }),
  });
  await app.firstWindow();
  if (typeof electronBinary !== 'string') {
    throw new Error('The electron package gave no path to its binary.');
  }

  const second = spawn(electronBinary, [desktop], {
    env: appEnv({ FILMFILE_FOLDER: filmFile }),
    stdio: 'ignore',
  });
  const code = await new Promise((resolve) => second.on('exit', resolve));

  expect(code).toBe(0);
  expect(app.windows()).toHaveLength(1);
  await app.close();
});

test('on first launch the app explains, asks for the FilmFile folder, refuses other folders, makes a Library in an empty one and remembers it', async () => {
  const photos = folderWith('photos', ['holiday.jpg']);
  // An archive folder chosen directly is another folder too.
  const oldArchive = folderWith('old-archive', ['archive.json']);
  const empty = folderWith('new-folder');

  const app = await launchChoosing([
    { button: 'Choose Folder…' },
    { choose: photos },
    { button: 'Choose Again' },
    { choose: oldArchive },
    { button: 'Choose Again' },
    { choose: empty },
  ]);
  const window = await app.firstWindow();

  // An empty folder becomes a new FilmFile folder, set up in the window as in a browser.
  await expect(
    window.getByRole('heading', { name: 'Set up FilmFile' }),
  ).toBeVisible();
  expect(await dialogsShown(app)).toEqual([
    welcome,
    chooser,
    notFilmFileFolder(photos),
    chooser,
    notFilmFileFolder(oldArchive),
    chooser,
  ]);
  expect(readdirSync(empty)).toEqual(['Library']);
  expect(readdirSync(photos)).toEqual(['holiday.jpg']);
  expect(remembered()).toEqual({ folder: empty });
  await app.close();

  // Next time it opens the same folder without asking.
  const again = await launchChoosing([]);
  await expect(
    (await again.firstWindow()).getByRole('heading', {
      name: 'Set up FilmFile',
    }),
  ).toBeVisible();
  expect(await dialogsShown(again)).toEqual([]);
  await again.close();
});

test('cancelling the folder chooser goes back to the first-launch message', async () => {
  const empty = folderWith('new-folder');
  const app = await launchChoosing([
    { button: 'Choose Folder…' },
    { cancel: true },
    { button: 'Choose Folder…' },
    { choose: empty },
  ]);

  await expect(
    (await app.firstWindow()).getByRole('heading', {
      name: 'Set up FilmFile',
    }),
  ).toBeVisible();

  expect(await dialogsShown(app)).toEqual([welcome, chooser, welcome, chooser]);
  await app.close();
});

test('Quit on the first-launch message quits the app, remembering nothing', async () => {
  const app = await launchChoosing([{ button: 'Quit' }]);

  await app.waitForEvent('close');

  expect(existsSync(path.join(userData, 'settings.json'))).toBe(false);
});

test('File › Open FilmFile Folder… switches to another FilmFile folder, and remembers it', async () => {
  remember(filmFile);
  const other = folderWith('other-folder');
  const app = await launchChoosing([{ choose: other }]);
  const first = await app.firstWindow();
  await expect(
    first.getByRole('heading', { level: 1, name: 'Rolls' }),
  ).toBeVisible();

  const opened = app.waitForEvent('window');
  await app.evaluate(({ Menu }) => {
    Menu.getApplicationMenu()?.getMenuItemById('open-folder')?.click();
  });

  await expect(
    (await opened).getByRole('heading', { name: 'Set up FilmFile' }),
  ).toBeVisible();
  expect(app.windows()).toHaveLength(1);
  expect(readdirSync(other)).toEqual(['Library']);
  expect(remembered()).toEqual({ folder: other });
  await app.close();
});

test('File › Show FilmFile Folder in Finder opens the FilmFile folder', async () => {
  remember(filmFile);
  const app = await launchChoosing([]);
  await expect(
    (await app.firstWindow()).getByRole('heading', { level: 1, name: 'Rolls' }),
  ).toBeVisible();

  await app.evaluate(({ Menu }) => {
    Menu.getApplicationMenu()?.getMenuItemById('show-folder')?.click();
  });

  await expect
    .poll(() =>
      app.evaluate((): unknown => Reflect.get(globalThis, 'pathsOpened')),
    )
    .toEqual([filmFile]);
  await app.close();
});

test('a folder that has gone missing is asked for again, saying where it was', async () => {
  const unplugged = path.join(root, 'Volumes', 'Photos', 'FilmFile');
  remember(unplugged);

  const app = await launchChoosing([
    { button: 'Choose Another…' },
    { choose: filmFile },
  ]);

  await expect(
    (await app.firstWindow()).getByRole('heading', { level: 1, name: 'Rolls' }),
  ).toBeVisible();
  expect(await dialogsShown(app)).toEqual([
    {
      message: 'FilmFile can’t find your folder.',
      detail: `It was at ${unplugged}. If it’s on a drive that isn’t connected, connect it and try again.`,
    },
    chooser,
  ]);
  await app.close();
});

test('a remembered folder that is no longer a FilmFile folder is refused, not opened', async () => {
  const moved = folderWith('moved', ['Exports']);
  remember(moved);

  const app = await launchChoosing([
    { button: 'Choose Another…' },
    { choose: filmFile },
  ]);

  await expect(
    (await app.firstWindow()).getByRole('heading', { level: 1, name: 'Rolls' }),
  ).toBeVisible();
  expect(await dialogsShown(app)).toEqual([notFilmFileFolder(moved), chooser]);
  expect(readdirSync(moved)).toEqual(['Exports']);
  await app.close();
});

/** The dialogs the app has shown so far, as a list. */
async function shownList(app: ElectronApplication): Promise<unknown[]> {
  const shown = await dialogsShown(app);
  return Array.isArray(shown) ? shown.map((entry: unknown) => entry) : [];
}

/** What a dialog entry says under `key`, if it's text there or in the object under `inside`. */
function saidBy(entry: unknown, key: string, inside?: string): string {
  const field = (from: unknown, name: string): unknown =>
    typeof from === 'object' && from !== null
      ? Reflect.get(from, name)
      : undefined;
  const said = field(inside === undefined ? entry : field(entry, inside), key);
  return typeof said === 'string' ? said : '';
}

test('a quick export in the desktop app asks where to save it, says where it went and starts there next time', async () => {
  const prints = folderWith('prints');
  const saved = path.join(prints, 'for-the-lab.jpg');
  const show =
    process.platform === 'darwin' ? 'Show in Finder' : 'Show in Folder';
  const app = await electron.launch({
    args: ['-r', dialogs, desktop],
    env: appEnv({
      FILMFILE_FOLDER: filmFile,
      FILMFILE_TEST_USER_DATA: userData,
      // Save the first, say where, and cancel the second.
      FILMFILE_TEST_DIALOGS: JSON.stringify([
        { save: saved },
        { button: show },
        { cancel: true },
      ]),
    }),
  });
  const window = await app.firstWindow();
  const service = new URL(window.url()).origin;

  // A roll with one scanned frame, made through the service as the page would.
  async function send(url: string, body: BodyInit, type: string) {
    const response = await fetch(`${service}${url}`, {
      method: 'POST',
      headers: { Origin: service, 'Content-Type': type },
      body,
    });
    const made: unknown = await response.json();
    return typeof made === 'object' && made !== null && 'id' in made
      ? String(made.id)
      : '';
  }
  const asJson = (body: object) => JSON.stringify(body);
  const roll = await send(
    '/api/rolls',
    asJson({ roll: '2026-053', shot: '2026' }),
    'application/json',
  );
  const frame = await send(
    `/api/rolls/${roll}/frames`,
    asJson({ number: '1' }),
    'application/json',
  );
  await send(
    `/api/rolls/${roll}/frames/${frame}/versions?file=12340001.jpg`,
    new Uint8Array(await aJpeg()),
    'image/jpeg',
  );

  async function download() {
    await window.getByRole('button', { name: 'Export' }).click();
    await window
      .getByRole('dialog', { name: 'Export frame 1' })
      .getByRole('button', { name: 'Download' })
      .click();
  }
  await window.goto(`${service}/rolls/${roll}/frames/${frame}`);
  await download();

  await expect.poll(() => existsSync(saved)).toBe(true);
  await expect.poll(async () => (await shownList(app)).length).toBe(2);
  const [asked, said] = await shownList(app);
  // It asked with the name the service gave, and then said where the file went.
  expect(path.basename(saidBy(asked, 'defaultPath', 'saveDialog'))).toBe(
    '2026-053-1.jpg',
  );
  expect(saidBy(said, 'message')).toBe(`Saved to ${saved}`);
  expect(
    await app.evaluate((): unknown =>
      Reflect.get(globalThis, 'pathsShownInFolder'),
    ),
  ).toEqual([saved]);
  expect(readFileSync(saved).subarray(0, 2)).toEqual(Buffer.from([0xff, 0xd8]));
  expect(remembered()).toMatchObject({ downloadFolder: prints });

  // The next one starts in that folder, and cancelling it saves and says nothing.
  await download();
  await expect.poll(async () => (await shownList(app)).length).toBe(3);
  expect(saidBy((await shownList(app))[2], 'defaultPath', 'saveDialog')).toBe(
    path.join(prints, '2026-053-1.jpg'),
  );
  expect(readdirSync(prints)).toEqual(['for-the-lab.jpg']);
  await app.close();
});
