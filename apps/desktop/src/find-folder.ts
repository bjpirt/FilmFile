import { dialog } from 'electron';
import { chooseFolder, notFilmFileFolder } from './choose-folder.ts';
import { folderKind } from './folder-kind.ts';

/**
 * The FilmFile folder to open on starting: the one remembered, if it's there
 * and valid; otherwise asked for. A remembered folder that has gone missing
 * (on a drive that isn't connected) is waited for or replaced; one that's
 * there but no longer a FilmFile folder is replaced. Undefined to quit.
 */
export async function findFolder(
  remembered: string | undefined,
): Promise<string | undefined> {
  if (remembered === undefined) {
    return welcome();
  }
  for (;;) {
    const kind = await folderKind(remembered);
    if (kind === 'filmfile' || kind === 'empty') {
      return remembered;
    }
    const retry = kind === 'missing';
    const { response } = await dialog.showMessageBox({
      type: 'warning',
      message: retry
        ? 'FilmFile can’t find your folder.'
        : 'That isn’t a FilmFile folder.',
      detail: retry
        ? `It was at ${remembered}. If it’s on a drive that isn’t connected, connect it and try again.`
        : notFilmFileFolder(remembered),
      buttons: retry
        ? ['Try Again', 'Choose Another…', 'Quit']
        : ['Choose Another…', 'Quit'],
      defaultId: 0,
      cancelId: retry ? 2 : 1,
    });
    const choice = ['Try Again', 'Choose Another…', 'Quit'][
      retry ? response : response + 1
    ];
    if (choice === 'Quit') {
      return undefined;
    }
    if (choice === 'Choose Another…') {
      const chosen = await chooseFolder();
      if (chosen !== undefined) {
        return chosen;
      }
    }
  }
}

/** First launch: says what the folder is for, then asks for it; cancelling the chooser comes back here. */
async function welcome(): Promise<string | undefined> {
  for (;;) {
    const { response } = await dialog.showMessageBox({
      message: 'Welcome to FilmFile',
      detail:
        'FilmFile keeps your library, and everything made from it, in one folder. Choose where.',
      buttons: ['Quit', 'Choose Folder…'],
      defaultId: 1,
      cancelId: 0,
    });
    if (response === 0) {
      return undefined;
    }
    const chosen = await chooseFolder();
    if (chosen !== undefined) {
      return chosen;
    }
  }
}
