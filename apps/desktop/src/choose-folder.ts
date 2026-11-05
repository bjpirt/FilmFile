import { app, dialog, type BrowserWindow } from 'electron';
import path from 'node:path';
import { folderKind } from './folder-kind.ts';

/** Where the chooser starts: `~/Pictures/FilmFile` if it's there, otherwise `~/Pictures`. */
async function startingFolder(): Promise<string> {
  const pictures = app.getPath('pictures');
  const suggested = path.join(pictures, 'FilmFile');
  return (await folderKind(suggested)) === 'missing' ? pictures : suggested;
}

/**
 * Asks for the FilmFile folder with the system's folder chooser, over
 * `window` when there is one. An empty folder will become a new FilmFile
 * folder and one with a Library opens; any other folder, an archive folder
 * chosen directly among them, is refused and asked for again (D63).
 * Undefined if no folder is chosen.
 */
export async function chooseFolder(
  window?: BrowserWindow,
): Promise<string | undefined> {
  for (;;) {
    const options: Electron.OpenDialogOptions = {
      title: 'Where should FilmFile keep its files?',
      message:
        'Choose your FilmFile folder, or a new or empty folder to start one.',
      buttonLabel: 'Use This Folder',
      defaultPath: await startingFolder(),
      properties: ['openDirectory', 'createDirectory'],
    };
    const { canceled, filePaths } =
      window === undefined
        ? await dialog.showOpenDialog(options)
        : await dialog.showOpenDialog(window, options);
    const [folder] = filePaths;
    if (canceled || folder === undefined) {
      return undefined;
    }
    if ((await folderKind(folder)) !== 'other') {
      return folder;
    }
    await dialog.showMessageBox({
      type: 'warning',
      message: 'That isn’t a FilmFile folder.',
      detail: notFilmFileFolder(folder),
      buttons: ['Choose Again'],
    });
  }
}

/** Why a folder was refused, and what to do instead. */
export function notFilmFileFolder(folder: string): string {
  return `${folder} has other files in it and no Library. Choose your FilmFile folder, or an empty folder to start a new one.`;
}
