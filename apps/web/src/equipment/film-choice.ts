import type { FilmFormat, FilmType } from '@filmfile/contracts/equipment';
import type { EquipmentChoice } from './equipment-choice.ts';

/** A new film stock's details as entered: the ISO as typed, blanks for none. */
export interface NewFilmStock {
  readonly make: string;
  readonly name: string;
  readonly iso: string;
  readonly type: FilmType | '';
  readonly format: FilmFormat | '';
}

export type FilmChoice = EquipmentChoice<NewFilmStock>;

export const blankFilmStock: NewFilmStock = {
  make: '',
  name: '',
  iso: '',
  type: '',
  format: '',
};
