/** Which scan is given a number, and which way the numbers count along the scans. */
export interface Renumbering {
  readonly from: 'first' | 'last';
  readonly number: number;
  readonly direction: 'up' | 'down';
}

/**
 * Frame numbers for a roll's scans, in scan order: the first or last scan is
 * frame `number`, and from scan to scan the numbers count up or down (down for
 * a roll the lab scanned tail to head). Plain integers, below zero if need be (D19).
 */
export function renumber(count: number, renumbering: Renumbering): string[] {
  const step = renumbering.direction === 'up' ? 1 : -1;
  const first =
    renumbering.from === 'first'
      ? renumbering.number
      : renumbering.number - (count - 1) * step;
  return Array.from({ length: count }, (_, i) => String(first + i * step));
}
