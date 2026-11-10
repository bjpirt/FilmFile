import type { PickOrAdd } from '../forms/pick-or-add.ts';
import type { ShotFields } from '../rolls/shot-fields.ts';

/** A new event's details as entered: its name and optional date (a year, then optionally a month and day). */
export interface NewEvent {
  readonly name: string;
  readonly date: ShotFields;
}

export type EventChoice = PickOrAdd<NewEvent>;

export const blankEvent: NewEvent = {
  name: '',
  date: { year: '', month: '', day: '', time: '' },
};
