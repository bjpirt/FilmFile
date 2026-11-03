import { z } from 'zod';
import {
  filmFormats,
  filmTypes,
  type FilmStock,
} from '../../../domain/equipment/film-stock.ts';

// The persistence model for a film stock: equipment/films/<slug>.json. The
// slug is the file name, so the file holds only the rest.

const currentSchema = 1;

const storedFilmStock = z.object({
  schema: z.literal(currentSchema),
  make: z.string().min(1),
  name: z.string().min(1),
  iso: z.number().int().positive().nullable().default(null),
  type: z.enum(filmTypes).nullable().default(null),
  format: z.enum(filmFormats).nullable().default(null),
});

type FilmStockDetails = Omit<FilmStock, 'slug'>;

/** The film stock's details in a film stock file's text; throws if the file isn't one. */
export function parseFilmStockFile(text: string): FilmStockDetails {
  const { make, name, iso, type, format } = storedFilmStock.parse(
    JSON.parse(text),
  );
  return { make, name, iso, type, format };
}

/** A film stock as file text: keys in a fixed order, two-space indent, trailing newline. */
export function filmStockFileContent(film: FilmStockDetails): string {
  const stored: z.input<typeof storedFilmStock> = {
    schema: currentSchema,
    make: film.make,
    name: film.name,
    iso: film.iso,
    type: film.type,
    format: film.format,
  };
  return `${JSON.stringify(stored, null, 2)}\n`;
}
