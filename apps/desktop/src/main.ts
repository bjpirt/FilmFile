import { app, dialog, session, type BrowserWindow } from 'electron';
import { openWindow } from './open-window.ts';
import { startService, type Service } from './start-service.ts';

// The desktop app (U82, D54): starts the service and opens a window on it.
// Nothing here awaits at the top level: Electron can't fire `ready` until
// this module has finished loading.

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
      if ((process.env.FILMFILE_ARCHIVE ?? '') === '') {
        throw new Error(
          'Set FILMFILE_ARCHIVE to the folder that holds the archive.',
        );
      }
      // The page asks for nothing: no camera, microphone, notifications or location.
      session.defaultSession.setPermissionRequestHandler(
        (_contents, _permission, answer) => {
          answer(false);
        },
      );
      service = await startService();
      window = openWindow(service.origin);
    })
    .catch((error: unknown) => {
      dialog.showErrorBox(
        'FilmFile couldn’t start',
        error instanceof Error ? error.message : String(error),
      );
      app.exit(1);
    });
}
