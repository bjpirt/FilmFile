import type { ApiClient } from '@filmfile/contracts/client';
import type { FilmStock } from '@filmfile/contracts/equipment';
import { useQuery } from '@tanstack/react-query';

/** The archive's film stocks, ordered by make and name; none until they've loaded. */
export function useFilmStocks(api: ApiClient): readonly FilmStock[] {
  const films = useQuery({
    queryKey: ['films'],
    queryFn: async () => {
      const { data } = await api.GET('/api/equipment/films');
      if (data === undefined) {
        throw new Error("Couldn't load the film stocks.");
      }
      return data.films;
    },
  });
  return films.data ?? [];
}

/** A film stock as it's shown: make, name and speed, e.g. "Kodak Portra 400". */
export function filmStockLabel(
  film: Pick<FilmStock, 'make' | 'name' | 'iso'>,
): string {
  return [
    film.make,
    film.name,
    ...(film.iso === null ? [] : [String(film.iso)]),
  ].join(' ');
}

/** What a roll's film stock is called; its slug if the film stock isn't known. */
export function filmStockName(
  films: readonly FilmStock[],
  slug: string | null,
): string | undefined {
  if (slug === null) {
    return undefined;
  }
  const film = films.find((f) => f.slug === slug);
  return film === undefined ? slug : filmStockLabel(film);
}

/** The film stock with the name typed, ignoring case. */
export function filmStockNamed(
  films: readonly FilmStock[],
  typed: string,
): FilmStock | undefined {
  const name = typed.trim().toLowerCase();
  return films.find((film) => filmStockLabel(film).toLowerCase() === name);
}
