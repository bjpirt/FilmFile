const key = 'filmfile.frameDetailsOpen';

// Whether the frame view shows its details panel, remembered in the browser
// as a convenience; closed unless opened, so the image has the room.

export function rememberedDetailsOpen(): boolean {
  try {
    return localStorage.getItem(key) === 'true';
  } catch {
    return false;
  }
}

export function rememberDetailsOpen(open: boolean): void {
  try {
    localStorage.setItem(key, String(open));
  } catch {
    // Not remembered this time; the toggle still works.
  }
}
