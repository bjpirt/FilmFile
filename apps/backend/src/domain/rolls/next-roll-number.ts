import { isRollNumber, type RollNumber } from './roll-number.ts';

/**
 * The next free roll number of a year (D67): one more than the highest of
 * that year among `taken`, so a gap a deleted roll left isn't reused. `taken`
 * holds the numbers of the rolls and the names of folders that can't be read,
 * a number counting whether it's alone or has an ID after it
 * (`2026-020-Q2P7RM4K`). A year has 999 numbers: undefined when none is left.
 * The web app has its own copy of this rule, which must agree.
 */
export function nextRollNumber(
  year: string,
  taken: readonly string[],
): RollNumber | undefined {
  let highest = 0;
  for (const name of taken) {
    const found = /^(\d{4})-(\d{3})(?:-|$)/.exec(name);
    if (found?.[1] === year) {
      highest = Math.max(highest, Number(found[2]));
    }
  }
  const next = `${year}-${String(highest + 1).padStart(3, '0')}`;
  return highest < 999 && isRollNumber(next) ? next : undefined;
}
