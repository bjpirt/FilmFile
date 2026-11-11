import { compareRollNumbers } from '../rolls/roll-number.ts';
import type { FrameFacts } from './frame-facts.ts';

/**
 * Shot order: by when it was shot (its own date, else its roll's), undated
 * last, then by roll number and the frame's place on its roll.
 */
export function compareShotOrder(a: FrameFacts, b: FrameFacts): number {
  if (a.shot !== b.shot) {
    if (a.shot === undefined) {
      return 1;
    }
    if (b.shot === undefined) {
      return -1;
    }
    return a.shot < b.shot ? -1 : 1;
  }
  return (
    compareRollNumbers(a.rollNumber, b.rollNumber) || a.position - b.position
  );
}
