import { dialog, type BrowserWindow } from 'electron';
import { folderKind } from './folder-kind.ts';

/**
 * Asks for the archive's folder with the system's folder picker, over
 * `window` when there is one. An empty folder will be set up as a new
 * archive; a folder of other files is refused, and asked for again. Undefined
 * if no folder is chosen.
 */
export async function chooseArchive(
  window?: BrowserWindow,
): Promise<string | undefined> {
  for (;;) {
    const options: Electron.OpenDialogOptions = {
      title: 'Where’s your FilmFile archive?',
      message: 'Choose your archive, or an empty folder to start a new one.',
      buttonLabel: 'Use This Folder',
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
      message: 'That folder isn’t a FilmFile archive.',
      detail: `${folder} has other files in it. Choose your archive, or an empty folder to start a new one.`,
      buttons: ['Choose Again'],
    });
  }
}
