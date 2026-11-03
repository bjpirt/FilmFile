import type { FilmFormat, FilmType } from '@filmfile/contracts/equipment';
import type { PickOrAdd } from '../forms/pick-or-add.ts';

/** A new film stock's details as entered: the ISO as typed, blanks for none. */
export interface NewFilmStock {
  readonly make: string;
  readonly name: string;
  readonly iso: string;
  readonly type: FilmType | '';
  readonly format: FilmFormat | '';
}

export type FilmChoice = PickOrAdd<NewFilmStock>;

export const blankFilmStock: NewFilmStock = {
  make: '',
  name: '',
  iso: '',
  type: '',
  format: '',
};
