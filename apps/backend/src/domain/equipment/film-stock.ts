import type { EquipmentSlug } from './equipment-slug.ts';

/** What kind of picture the film gives. */
export const filmTypes = [
  'black-and-white',
  'colour-negative',
  'colour-slide',
] as const;
export type FilmType = (typeof filmTypes)[number];

/** The size of film. */
export const filmFormats = [
  '35mm',
  '120',
  '220',
  '127',
  '110',
  '4x5',
  '8x10',
] as const;
export type FilmFormat = (typeof filmFormats)[number];

/** A film stock rolls are shot on, e.g. Kodak Portra at ISO 400, in 35mm. */
export interface FilmStock {
  readonly slug: EquipmentSlug;
  /** Who makes it, e.g. "Kodak". */
  readonly make: string;
  /** The stock's own name, e.g. "Portra". */
  readonly name: string;
  /** Its box speed, or null if not given. */
  readonly iso: number | null;
  readonly type: FilmType | null;
  readonly format: FilmFormat | null;
}

/**
 * What a film stock is called: its make, name and speed, e.g. "Kodak Portra
 * 400". Its slug is made from this, so stocks differing only in speed are
 * told apart.
 */
export function filmStockLabel(
  film: Pick<FilmStock, 'make' | 'name' | 'iso'>,
): string {
  return [
    film.make,
    film.name,
    ...(film.iso === null ? [] : [String(film.iso)]),
  ].join(' ');
}
