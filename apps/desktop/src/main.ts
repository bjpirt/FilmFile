import {
  app,
  dialog,
  Menu,
  session,
  shell,
  type BrowserWindow,
} from 'electron';
import path from 'node:path';
import { appMenu } from './app-menu.ts';
import { chooseFolder } from './choose-folder.ts';
import { readSettings, updateSettings } from './desktop-settings.ts';
import type { ServiceRequests } from './service-messages.ts';
import { findFolder } from './find-folder.ts';
import { handleDownload } from './handle-download.ts';
import {
  exportFinishedMessage,
  handleServiceMessage,
} from './service-messages.ts';
import { openWindow } from './open-window.ts';
import { startService, type Service } from './start-service.ts';

// The desktop app (U82, D54): starts the service on the FilmFile folder and
// opens a window on it. Nothing here awaits at the top level: Electron can't fire
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
  let folder: string | undefined;
  let stopping = false;
  // This computer's settings, not the archive's (D52).
  const settingsFile = () =>
    path.join(app.getPath('userData'), 'settings.json');

  /** Starts the service on the FilmFile folder and opens a window on it, closing those of the folder open before. */
  async function open(next: string): Promise<void> {
    const started = await startService(next, (message, reply) => {
      handleServiceMessage(message, serviceRequests, reply).catch(
        couldNot('export those frames'),
      );
    });
    const previous = { window, service };
    folder = next;
    service = started;
    window = openWindow(started.origin);
    previous.window?.close();
    await previous.service?.stop();
  }

  /** File › Open FilmFile Folder… (FF-105): asks for another folder, opens it and remembers it. */
  async function openAnother(): Promise<void> {
    const chosen = await chooseFolder(window);
    if (chosen === undefined) {
      return;
    }
    await open(chosen);
    await updateSettings(settingsFile(), { folder: chosen });
  }

  /** Remembers the folder a download went to, and says where it is, with a way to see it there. */
  async function tellSaved(file: string, savedTo: string): Promise<void> {
    await updateSettings(settingsFile(), { downloadFolder: savedTo });
    const show =
      process.platform === 'darwin' ? 'Show in Finder' : 'Show in Folder';
    const options: Electron.MessageBoxOptions = {
      message: `Saved to ${file}`,
      buttons: [show, 'OK'],
      defaultId: 1,
    };
    const { response } =
      window === undefined
        ? await dialog.showMessageBox(options)
        : await dialog.showMessageBox(window, options);
    if (response === 0) {
      shell.showItemInFolder(file);
    }
  }

  /** The folder an export of several frames was last written into (FF-176). */
  let exportFolder: string | undefined;

  /** What the service asks of the app (D100): a folder to export into, and telling where an export went. */
  const serviceRequests: ServiceRequests = {
    chooseExportFolder: async () => {
      const options: Electron.OpenDialogOptions = {
        title: 'Where should the exported photographs go?',
        message: 'Choose a folder for the photographs to be written into.',
        buttonLabel: 'Export Here',
        defaultPath: exportFolder ?? app.getPath('downloads'),
        properties: ['openDirectory', 'createDirectory'],
      };
      const { canceled, filePaths } =
        window === undefined
          ? await dialog.showOpenDialog(options)
          : await dialog.showOpenDialog(window, options);
      const [chosen] = filePaths;
      if (canceled || chosen === undefined) {
        return undefined;
      }
      exportFolder = chosen;
      await updateSettings(settingsFile(), { exportFolder: chosen });
      return chosen;
    },
    exportFinished: (result) => {
      tellExported(result).catch(couldNot('show where the files went'));
    },
  };

  /** Says where an export went and what was left out, with a way to see the folder. */
  async function tellExported(result: {
    readonly folder: string;
    readonly written: number;
    readonly leftOut: number;
  }): Promise<void> {
    const show =
      process.platform === 'darwin' ? 'Show in Finder' : 'Show in Folder';
    const options: Electron.MessageBoxOptions = {
      ...exportFinishedMessage(result),
      buttons: [show, 'OK'],
      defaultId: 1,
    };
    const { response } =
      window === undefined
        ? await dialog.showMessageBox(options)
        : await dialog.showMessageBox(window, options);
    if (response === 0) {
      const problem = await shell.openPath(result.folder);
      if (problem !== '') {
        throw new Error(problem);
      }
    }
  }

  /** File › Show FilmFile Folder in Finder. */
  async function showFolder(): Promise<void> {
    if (folder === undefined) {
      return;
    }
    const problem = await shell.openPath(folder);
    if (problem !== '') {
      throw new Error(problem);
    }
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
      // Where downloads (a quick export) are saved is asked for each time (FF-166).
      const saved = await readSettings(settingsFile());
      exportFolder = saved.exportFolder;
      let downloadFolder = saved.downloadFolder;
      session.defaultSession.on('will-download', (_event, item) => {
        handleDownload(item, {
          lastFolder: () => downloadFolder,
          downloads: app.getPath('downloads'),
          saved: (file) => {
            downloadFolder = path.dirname(file);
            tellSaved(file, downloadFolder).catch(couldNot('save that file'));
          },
        });
      });
      Menu.setApplicationMenu(
        appMenu({
          openFolder: () => {
            openAnother().catch(couldNot('open that folder'));
          },
          showFolder: () => {
            showFolder().catch(couldNot('show the folder'));
          },
        }),
      );
      // FILMFILE_FOLDER, when set, is for development and the journeys.
      const given = process.env.FILMFILE_FOLDER ?? '';
      if (given !== '') {
        await open(given);
        return;
      }
      const remembered = (await readSettings(settingsFile())).folder;
      const chosen = await findFolder(remembered);
      if (chosen === undefined) {
        app.quit();
        return;
      }
      await open(chosen);
      if (chosen !== remembered) {
        await updateSettings(settingsFile(), { folder: chosen });
      }
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
