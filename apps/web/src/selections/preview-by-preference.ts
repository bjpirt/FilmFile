const key = 'filmfile.previewBy';

/** What a selection's frames are previewed under. */
export type PreviewBy = 'roll' | 'event';

// Remembered in the browser as a convenience, not saved in the site (FF-182);
// by roll unless changed.

export function rememberedPreviewBy(): PreviewBy {
  try {
    return localStorage.getItem(key) === 'event' ? 'event' : 'roll';
  } catch {
    return 'roll';
  }
}

export function rememberPreviewBy(previewBy: PreviewBy): void {
  try {
    localStorage.setItem(key, previewBy);
  } catch {
    // Not remembered this time; the switch still works.
  }
}
