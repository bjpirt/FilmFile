import { BrowserWindow, shell } from 'electron';

/**
 * A window on the service's web UI, locked down as a browser tab is: no
 * Node.js and no preload in the page, which only talks to the service's API
 * (D54). Links and new windows going anywhere else open in the default
 * browser instead.
 */
export function openWindow(origin: string): BrowserWindow {
  const window = new BrowserWindow({
    width: 1280,
    height: 860,
    title: 'FilmFile',
    // The UI's own background, so the window doesn't flash white as it loads.
    backgroundColor: '#111214',
    show: false,
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  });
  window.once('ready-to-show', () => {
    window.show();
  });
  window.webContents.setWindowOpenHandler(({ url }) => {
    openOutside(url);
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', (event, url) => {
    if (new URL(url).origin !== origin) {
      event.preventDefault();
      openOutside(url);
    }
  });
  void window.loadURL(origin);
  return window;
}

/** Web links only: a page mustn't be able to open files or other apps. */
function openOutside(url: string): void {
  const { protocol } = new URL(url);
  if (protocol === 'https:' || protocol === 'http:') {
    void shell.openExternal(url);
  }
}
