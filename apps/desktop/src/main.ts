import { app, dialog, Menu, session, type BrowserWindow } from 'electron';
import path from 'node:path';
import { appMenu } from './app-menu.ts';
import { chooseArchive } from './choose-archive.ts';
import { readSettings, saveSettings } from './desktop-settings.ts';
import { findArchive } from './find-archive.ts';
import { openWindow } from './open-window.ts';
import { startService, type Service } from './start-service.ts';

// The desktop app (U82, D54): starts the service on the archive and opens a
// window on it. Nothing here awaits at the top level: Electron can't fire
// `ready` until this module has finished loading.

app.setName('FilmFile');

// One copy only, so the archive has one writer: opening it again brings the
// window forward instead.
if (app.requestSingleInstanceLock()) {
  run();
} else {
  app.quit();
}

function run(): void {
  let window: BrowserWindow | undefined;
  let service: Service | undefined;
  let stopping = false;
  // This computer's settings, not the archive's (D52).
  const settingsFile = () =>
    path.join(app.getPath('userData'), 'settings.json');

  /** Starts the service on `archive` and opens a window on it, closing those of the archive open before. */
  async function open(archive: string): Promise<void> {
    const next = await startService(archive);
    const previous = { window, service };
    service = next;
    window = openWindow(next.origin);
    previous.window?.close();
    await previous.service?.stop();
  }

  /** File › Open Archive… (U83): asks for another archive, opens it and remembers it. */
  async function openAnother(): Promise<void> {
    const archive = await chooseArchive(window);
    if (archive === undefined) {
      return;
    }
    await saveSettings(settingsFile(), { archive });
    await open(archive);
  }

  app.on('second-instance', () => {
    if (window === undefined) {
      return;
    }
    if (window.isMinimized()) {
      window.restore();
    }
    window.focus();
  });

  app.on('window-all-closed', () => {
    app.quit();
  });

  // Stops the service before quitting, so saves in progress finish.
  app.on('before-quit', (event) => {
    if (service === undefined || stopping) {
      return;
    }
    event.preventDefault();
    stopping = true;
    void service.stop().finally(() => {
      app.exit(0);
    });
  });

  void app
    .whenReady()
    .then(async () => {
      // The page asks for nothing: no camera, microphone, notifications or location.
      session.defaultSession.setPermissionRequestHandler(
        (_contents, _permission, answer) => {
          answer(false);
        },
      );
      Menu.setApplicationMenu(
        appMenu(() => {
          openAnother().catch(couldNot('open that archive'));
        }),
      );
      // FILMFILE_ARCHIVE, when set, is for development and the journeys.
      const given = process.env.FILMFILE_ARCHIVE ?? '';
      if (given !== '') {
        await open(given);
        return;
      }
      const remembered = (await readSettings(settingsFile())).archive;
      const archive = await findArchive(remembered);
      if (archive === undefined) {
        app.quit();
        return;
      }
      if (archive !== remembered) {
        await saveSettings(settingsFile(), { archive });
      }
      await open(archive);
    })
    .catch((error: unknown) => {
      couldNot('start')(error);
      app.exit(1);
    });
}

/** Shows what went wrong, as "FilmFile couldn't <doing>". */
function couldNot(doing: string): (error: unknown) => void {
  return (error) => {
    dialog.showErrorBox(
      `FilmFile couldn’t ${doing}`,
      error instanceof Error ? error.message : String(error),
    );
  };
}
