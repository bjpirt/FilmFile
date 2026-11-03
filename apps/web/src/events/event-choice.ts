import type { PickOrAdd } from '../forms/pick-or-add.ts';

/** A new event's details as entered. */
export interface NewEvent {
  readonly name: string;
}

export type EventChoice = PickOrAdd<NewEvent>;

export const blankEvent: NewEvent = { name: '' };
