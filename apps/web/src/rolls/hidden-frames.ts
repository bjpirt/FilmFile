/** Whether a page's address asks for its hidden frames too, `?hidden=show` (D99). */
export function showingHidden(search: string): boolean {
  return new URLSearchParams(search).get('hidden') === 'show';
}

/** The frames a page lists: all of them with `showHidden`, otherwise those not hidden. */
export function shownFrames<T extends { readonly hidden: boolean }>(
  frames: readonly T[],
  showHidden: boolean,
): T[] {
  return showHidden ? [...frames] : frames.filter((frame) => !frame.hidden);
}

/** How many of the frames are hidden. */
export function hiddenCount(
  frames: readonly { readonly hidden: boolean }[],
): number {
  return frames.filter((frame) => frame.hidden).length;
}
