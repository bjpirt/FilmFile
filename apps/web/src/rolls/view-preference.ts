export type RollsView = 'grid' | 'list';

const key = 'filmfile.rollsView';

// Remembered in the browser as a convenience (D23). Storage can be missing or
// refuse access, e.g. in a private window, so the page falls back to the grid.

export function rememberedView(): RollsView {
  try {
    return localStorage.getItem(key) === 'list' ? 'list' : 'grid';
  } catch {
    return 'grid';
  }
}

export function rememberView(view: RollsView): void {
  try {
    localStorage.setItem(key, view);
  } catch {
    // Not remembered this time; the switch still works.
  }
}
