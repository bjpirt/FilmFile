import type { ApiClient } from '@filmfile/contracts/client';
import type { FilmChoice, NewFilmStock } from './film-choice.ts';
import { filmStockLabel, filmStockNamed } from './use-film-stocks.ts';

/** The film stock chosen, by slug (null for none), or why there isn't one. */
export type ChosenFilmStock =
  | { readonly ok: true; readonly slug: string | null }
  | { readonly ok: false; readonly problem: string };

function problem(text: string): ChosenFilmStock {
  return { ok: false, problem: text };
}

/** The slug of the film stock chosen, creating it now if it's new. */
export async function chooseFilmStock(
  api: ApiClient,
  choice: FilmChoice,
): Promise<ChosenFilmStock> {
  switch (choice.kind) {
    case 'none':
      return { ok: true, slug: null };
    case 'existing':
      return { ok: true, slug: choice.slug };
    case 'new':
      return createFilmStock(api, choice.details);
  }
}

async function createFilmStock(
  api: ApiClient,
  details: NewFilmStock,
): Promise<ChosenFilmStock> {
  const make = details.make.trim();
  const name = details.name.trim();
  const iso = details.iso.trim();
  if (make === '') {
    return problem("Enter the new film stock's make, like Kodak.");
  }
  if (name === '') {
    return problem("Enter the new film stock's name, like Portra.");
  }
  if (!/^\d*$/.test(iso)) {
    return problem('Enter the ISO as a whole number, like 400.');
  }
  const speed = iso === '' ? null : Number(iso);
  const label = filmStockLabel({ make, name, iso: speed });
  const { data, response } = await api.POST('/api/equipment/films', {
    body: {
      make,
      name,
      iso: speed,
      type: details.type === '' ? null : details.type,
      format: details.format === '' ? null : details.format,
    },
  });
  if (data !== undefined) {
    return { ok: true, slug: data.slug };
  }
  switch (response.status) {
    case 409: {
      // Added since the list was loaded, perhaps elsewhere: use it.
      const latest = await api.GET('/api/equipment/films');
      const added = filmStockNamed(latest.data?.films ?? [], label);
      return added === undefined
        ? problem(
            `There's already a film stock with a name like ${label}. Choose it from the list.`,
          )
        : { ok: true, slug: added.slug };
    }
    case 422:
      return problem('Check the ISO: a whole number, like 400.');
    default:
      return problem("Couldn't add the film stock. Is the service running?");
  }
}
