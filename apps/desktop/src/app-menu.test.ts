import type { MenuItemConstructorOptions } from 'electron';
import { describe, expect, test } from 'vitest';
import { appMenu } from './app-menu.ts';

function nothing(): void {
  // A menu item's click, not used here.
}

const actions = {
  openFolder: nothing,
  showFolder: nothing,
  about: nothing,
  openGitHub: nothing,
};

/** A menu's items as a person reads them: labels, roles and separators. */
function itemsOf(
  menu: readonly MenuItemConstructorOptions[],
  label: string,
): (string | undefined)[] {
  const found = menu.find((item) => (item.label ?? item.role) === label);
  const submenu = found?.submenu;
  if (!Array.isArray(submenu)) {
    throw new Error(`No ${label} menu`);
  }
  return submenu.map((item: MenuItemConstructorOptions) =>
    item.type === 'separator' ? '---' : (item.label ?? item.role),
  );
}

describe('on a Mac', () => {
  const menu = appMenu('darwin', actions);

  test('the app menu has About FilmFile first, then the standard items', () => {
    expect(itemsOf(menu, 'FilmFile')).toEqual([
      'About FilmFile',
      '---',
      'services',
      '---',
      'hide',
      'hideOthers',
      'unhide',
      '---',
      'quit',
    ]);
  });

  test('Help has FilmFile on GitHub', () => {
    expect(itemsOf(menu, 'help')).toEqual(['FilmFile on GitHub']);
  });
});

describe.each(['win32', 'linux'] as const)('on %s', (platform) => {
  const menu = appMenu(platform, actions);

  test('there is no app menu', () => {
    expect(menu.map((item) => item.label ?? item.role)).toEqual([
      'File',
      'editMenu',
      'viewMenu',
      'windowMenu',
      'help',
    ]);
  });

  test('Help has FilmFile on GitHub, then About FilmFile', () => {
    expect(itemsOf(menu, 'help')).toEqual([
      'FilmFile on GitHub',
      '---',
      'About FilmFile',
    ]);
  });
});

test.each(['darwin', 'linux'] as const)(
  'on %s, About FilmFile and FilmFile on GitHub do what they say',
  (platform) => {
    const about = () => undefined;
    const openGitHub = () => undefined;
    const items = appMenu(platform, { ...actions, about, openGitHub }).flatMap(
      (item) => (Array.isArray(item.submenu) ? item.submenu : []),
    );
    const clickOf = (id: string) =>
      items.find((item: MenuItemConstructorOptions) => item.id === id)?.click;

    expect(clickOf('about')).toBe(about);
    expect(clickOf('github')).toBe(openGitHub);
  },
);
