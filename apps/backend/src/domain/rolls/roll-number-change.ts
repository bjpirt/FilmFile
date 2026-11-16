import type { Roll } from './roll.ts';

/** What a person is told when they try to renumber a filed roll. */
export const filedRollNumberMessage = "A filed roll's number can't be changed.";

/** Whether a roll's number may be changed: not once the roll is filed. */
export function mayChangeRollNumber(roll: Pick<Roll, 'filed'>): boolean {
  return !roll.filed;
}
