import {
  filmFormat,
  filmType,
  type FilmFormat,
  type FilmStock,
  type FilmType,
} from '@filmfile/contracts/equipment';
import {
  blankFilmStock,
  noFilmStock,
  type FilmChoice,
  type NewFilmStock,
} from './film-choice.ts';
import { filmStockLabel } from './use-film-stocks.ts';

// The options come from the contract's enums; every value needs a label.

const typeLabels: Record<FilmType, string> = {
  'black-and-white': 'Black and white',
  'colour-negative': 'Colour negative',
  'colour-slide': 'Colour slide',
};

const formatLabels: Record<FilmFormat, string> = {
  '35mm': '35mm',
  '120': '120',
  '220': '220',
  '127': '127',
  '110': '110',
  '4x5': '4×5',
  '8x10': '8×10',
};

// Option values: '' for none, a slug, or this, which no slug can be.
const addNew = '+new';

function Required() {
  return (
    <span className="required" aria-hidden="true">
      *
    </span>
  );
}

/** The new film stock's details, all on one row where they fit. */
function NewFilmStockFields({
  details,
  change,
}: {
  readonly details: NewFilmStock;
  readonly change: (details: NewFilmStock) => void;
}) {
  function changeDetail(detail: Partial<NewFilmStock>) {
    change({ ...details, ...detail });
  }

  return (
    <fieldset className="new-film-stock">
      <legend>New film stock</legend>
      <label>
        <span>
          Make <Required />
        </span>
        <input
          value={details.make}
          placeholder="Kodak"
          maxLength={50}
          autoFocus
          onChange={(event) => {
            changeDetail({ make: event.target.value });
          }}
        />
      </label>
      <label>
        <span>
          Name <Required />
        </span>
        <input
          value={details.name}
          placeholder="Portra"
          maxLength={100}
          onChange={(event) => {
            changeDetail({ name: event.target.value });
          }}
        />
      </label>
      <label>
        ISO
        <input
          className="numbers"
          inputMode="numeric"
          size={5}
          maxLength={6}
          value={details.iso}
          onChange={(event) => {
            changeDetail({ iso: event.target.value });
          }}
        />
      </label>
      <label>
        Type
        <select
          value={details.type}
          onChange={(event) => {
            const chosen = filmType.safeParse(event.target.value);
            changeDetail({ type: chosen.success ? chosen.data : '' });
          }}
        >
          <option value="">—</option>
          {filmType.options.map((type) => (
            <option key={type} value={type}>
              {typeLabels[type]}
            </option>
          ))}
        </select>
      </label>
      <label>
        Format
        <select
          value={details.format}
          onChange={(event) => {
            const chosen = filmFormat.safeParse(event.target.value);
            changeDetail({ format: chosen.success ? chosen.data : '' });
          }}
        >
          <option value="">—</option>
          {filmFormat.options.map((format) => (
            <option key={format} value={format}>
              {formatLabels[format]}
            </option>
          ))}
        </select>
      </label>
    </fieldset>
  );
}

/**
 * A film stock picked from the archive's, or Add new…, the last option,
 * which asks for the new film stock's details.
 */
export function FilmStockField({
  films,
  choice,
  change,
}: {
  readonly films: readonly FilmStock[];
  readonly choice: FilmChoice;
  readonly change: (choice: FilmChoice) => void;
}) {
  const value =
    choice.kind === 'none'
      ? ''
      : choice.kind === 'existing'
        ? choice.slug
        : addNew;
  // A roll's film stock not among those loaded (yet) still shows, by slug.
  const unlisted =
    choice.kind === 'existing' && !films.some((f) => f.slug === choice.slug)
      ? choice.slug
      : undefined;

  return (
    <>
      <label>
        Film stock
        <select
          value={value}
          onChange={(event) => {
            const chosen = event.target.value;
            change(
              chosen === ''
                ? noFilmStock
                : chosen === addNew
                  ? { kind: 'new', details: blankFilmStock }
                  : { kind: 'existing', slug: chosen },
            );
          }}
        >
          <option value="">—</option>
          {unlisted !== undefined && (
            <option value={unlisted}>{unlisted}</option>
          )}
          {films.map((film) => (
            <option key={film.slug} value={film.slug}>
              {filmStockLabel(film)}
            </option>
          ))}
          <option value={addNew}>Add new…</option>
        </select>
      </label>
      {choice.kind === 'new' && (
        <NewFilmStockFields
          details={choice.details}
          change={(details) => {
            change({ kind: 'new', details });
          }}
        />
      )}
    </>
  );
}
