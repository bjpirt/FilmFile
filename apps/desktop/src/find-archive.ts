import { dialog } from 'electron';
import { chooseArchive } from './choose-archive.ts';
import { folderKind } from './folder-kind.ts';

/**
 * The archive to open on starting: the one remembered, if it's there;
 * otherwise asked for. A remembered archive that has gone missing (on a drive
 * that isn't connected) is waited for or replaced. Undefined to quit.
 */
export async function findArchive(
  remembered: string | undefined,
): Promise<string | undefined> {
  let archive = remembered;
  while (archive !== undefined && (await folderKind(archive)) === 'missing') {
    const { response } = await dialog.showMessageBox({
      type: 'warning',
      message: 'FilmFile can’t find your archive.',
      detail: `It was at ${archive}. If it’s on a drive that isn’t connected, connect it and try again.`,
      buttons: ['Try Again', 'Choose Another…', 'Quit'],
      defaultId: 0,
      cancelId: 2,
    });
    if (response === 2) {
      return undefined;
    }
    if (response === 1) {
      archive = await chooseArchive();
    }
  }
  return archive ?? (await chooseArchive());
}
