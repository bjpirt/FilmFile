import type { FilmFormat, FilmType } from '@filmfile/contracts/equipment';

/** A new film stock's details as entered: the ISO as typed, blanks for none. */
export interface NewFilmStock {
  readonly make: string;
  readonly name: string;
  readonly iso: string;
  readonly type: FilmType | '';
  readonly format: FilmFormat | '';
}

/** The film stock chosen for a roll: none, one the archive has, or a new one. */
export type FilmChoice =
  | { readonly kind: 'none' }
  | { readonly kind: 'existing'; readonly slug: string }
  | { readonly kind: 'new'; readonly details: NewFilmStock };

export const noFilmStock: FilmChoice = { kind: 'none' };

export const blankFilmStock: NewFilmStock = {
  make: '',
  name: '',
  iso: '',
  type: '',
  format: '',
};

/** The choice for a roll's film stock, by slug. */
export function filmChoiceOf(slug: string | null): FilmChoice {
  return slug === null ? noFilmStock : { kind: 'existing', slug };
}
