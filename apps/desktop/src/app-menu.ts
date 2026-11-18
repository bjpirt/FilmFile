import type { MenuItemConstructorOptions } from 'electron';

/**
 * The app's menus, for `Menu.buildFromTemplate`: Electron's standard ones
 * (copy and paste among them), with File's "Open FilmFile Folder…" (FF-105)
 * and "Show FilmFile Folder in Finder", and "About FilmFile" and "FilmFile on
 * GitHub" (FF-194). On a Mac, About is first in the app menu, built here in
 * place of Electron's, whose About opens the Mac's own panel (D124);
 * elsewhere it's last in Help.
 */
export function appMenu(
  platform: NodeJS.Platform,
  actions: {
    readonly openFolder: () => void;
    readonly showFolder: () => void;
    readonly about: () => void;
    readonly openGitHub: () => void;
  },
): MenuItemConstructorOptions[] {
  const mac = platform === 'darwin';
  const about: MenuItemConstructorOptions = {
    id: 'about',
    label: 'About FilmFile',
    click: actions.about,
  };
  const appMenu: MenuItemConstructorOptions = {
    label: 'FilmFile',
    submenu: [
      about,
      { type: 'separator' },
      { role: 'services' },
      { type: 'separator' },
      { role: 'hide' },
      { role: 'hideOthers' },
      { role: 'unhide' },
      { type: 'separator' },
      { role: 'quit' },
    ],
  };
  return [
    ...(mac ? [appMenu] : []),
    {
      label: 'File',
      submenu: [
        {
          id: 'open-folder',
          label: 'Open FilmFile Folder…',
          accelerator: 'CmdOrCtrl+O',
          click: actions.openFolder,
        },
        {
          id: 'show-folder',
          label: mac
            ? 'Show FilmFile Folder in Finder'
            : 'Show FilmFile Folder',
          click: actions.showFolder,
        },
        { type: 'separator' },
        mac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
    {
      role: 'help',
      submenu: [
        {
          id: 'github',
          label: 'FilmFile on GitHub',
          click: actions.openGitHub,
        },
        ...(mac ? [] : [{ type: 'separator' } as const, about]),
      ],
    },
  ];
}
