import type { AppVersion } from './app-version.ts';

/** Where FilmFile lives, opened from Help and from About (FF-194). */
export const gitHub = 'https://github.com/bjpirt/FilmFile';

/** The button in About that opens `gitHub`; the other is "OK". */
export const gitHubButton = 0;

/**
 * "About FilmFile": our own message box on every platform, not the Mac's
 * About panel, which can't hold a link (D124). "OK" is the default, and what
 * Escape does.
 */
export function aboutBox({ version, dev }: AppVersion) {
  return {
    title: 'About FilmFile',
    message: 'FilmFile',
    detail: `Version ${version}${dev ? ' (dev)' : ''}`,
    buttons: ['FilmFile on GitHub', 'OK'],
    defaultId: 1,
    cancelId: 1,
  };
}
