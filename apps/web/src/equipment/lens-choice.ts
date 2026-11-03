import type { EquipmentChoice } from './equipment-choice.ts';

/** A new lens's details as entered: numbers as typed, blanks for none. */
export interface NewLens {
  readonly make: string;
  readonly name: string;
  readonly focalLength: string;
  readonly maxAperture: string;
}

export type LensChoice = EquipmentChoice<NewLens>;

export const blankLens: NewLens = {
  make: '',
  name: '',
  focalLength: '',
  maxAperture: '',
};
