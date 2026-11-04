import { Menu } from 'electron';

/**
 * The app's menus: Electron's standard ones (copy and paste among them),
 * with File's "Open Archive…" (U83).
 */
export function appMenu(openArchive: () => void): Menu {
  const mac = process.platform === 'darwin';
  return Menu.buildFromTemplate([
    ...(mac ? [{ role: 'appMenu' as const }] : []),
    {
      label: 'File',
      submenu: [
        {
          id: 'open-archive',
          label: 'Open Archive…',
          accelerator: 'CmdOrCtrl+O',
          click: openArchive,
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
