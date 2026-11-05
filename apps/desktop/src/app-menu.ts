import { Menu } from 'electron';

/**
 * The app's menus: Electron's standard ones (copy and paste among them),
 * with File's "Open FilmFile Folder…" (FF-105) and "Show FilmFile Folder in
 * Finder".
 */
export function appMenu({
  openFolder,
  showFolder,
}: {
  readonly openFolder: () => void;
  readonly showFolder: () => void;
}): Menu {
  const mac = process.platform === 'darwin';
  return Menu.buildFromTemplate([
    ...(mac ? [{ role: 'appMenu' as const }] : []),
    {
      label: 'File',
      submenu: [
        {
          id: 'open-folder',
          label: 'Open FilmFile Folder…',
          accelerator: 'CmdOrCtrl+O',
          click: openFolder,
        },
        {
          id: 'show-folder',
          label: mac
            ? 'Show FilmFile Folder in Finder'
            : 'Show FilmFile Folder',
          click: showFolder,
        },
        { type: 'separator' },
        mac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
  ]);
}
