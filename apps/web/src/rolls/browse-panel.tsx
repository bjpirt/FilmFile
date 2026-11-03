import type { Camera, FilmStock } from '@filmfile/contracts/equipment';
import type { Roll } from '@filmfile/contracts/rolls';
import { cameraName } from '../equipment/use-cameras.ts';
import { filmStockName } from '../equipment/use-film-stocks.ts';

/** One way into the rolls: all of them, or those from a year, shot on a camera or of a film stock. */
export interface RollsFilter {
  readonly year: string | undefined;
  readonly camera: string | undefined;
  readonly film: string | undefined;
}

const everyRoll: RollsFilter = {
  year: undefined,
  camera: undefined,
  film: undefined,
};

interface Option {
  readonly key: string;
  readonly label: string;
  readonly count: number;
}

function byLabel(a: Option, b: Option): number {
  return a.label.localeCompare(b.label, undefined, {
    sensitivity: 'base',
    numeric: true,
  });
}

/** Each distinct value among the rolls, with how many rolls have it. */
function counted(
  values: readonly string[],
  label: (value: string) => string,
): Option[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts].map(([key, count]) => ({ key, label: label(key), count }));
}

function BrowseSection({
  title,
  options,
  chosen,
  choose,
}: {
  readonly title: string;
  readonly options: readonly Option[];
  readonly chosen: string | undefined;
  readonly choose: (key: string) => void;
}) {
  const headingId = `browse-${title.toLowerCase().replace(/\W+/g, '-')}`;
  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId}>{title}</h2>
      {options.map((option) => (
        <button
          key={option.key}
          type="button"
          aria-pressed={chosen === option.key}
          onClick={() => {
            choose(option.key);
          }}
        >
          <span>{option.label}</span>
          <span className="muted">{option.count}</span>
        </button>
      ))}
    </section>
  );
}

/**
 * Ways into the rolls: all of them, or those from one year, shot on one
 * camera or of one film stock, one way at a time. More sections (events)
 * arrive with their data.
 */
export function BrowsePanel({
  rolls,
  cameras,
  films,
  filter,
  choose,
}: {
  readonly rolls: readonly Roll[];
  readonly cameras: readonly Camera[];
  readonly films: readonly FilmStock[];
  readonly filter: RollsFilter;
  readonly choose: (filter: RollsFilter) => void;
}) {
  const years = counted(
    rolls.map((roll) => roll.roll.slice(0, 4)),
    (year) => year,
  ).sort((a, b) => b.key.localeCompare(a.key));
  const rollCameras = counted(
    rolls.flatMap((roll) => (roll.camera === null ? [] : [roll.camera])),
    (slug) => cameraName(cameras, slug) ?? slug,
  ).sort(byLabel);
  const rollFilms = counted(
    rolls.flatMap((roll) => (roll.film === null ? [] : [roll.film])),
    (slug) => filmStockName(films, slug) ?? slug,
  ).sort(byLabel);

  return (
    <aside id="browse" className="browse" aria-label="Browse rolls">
      <button
        type="button"
        aria-pressed={
          filter.year === undefined &&
          filter.camera === undefined &&
          filter.film === undefined
        }
        onClick={() => {
          choose(everyRoll);
        }}
      >
        <span>All rolls</span>
        <span className="muted">{rolls.length}</span>
      </button>
      <BrowseSection
        title="Years"
        options={years}
        chosen={filter.year}
        choose={(year) => {
          choose({ ...everyRoll, year });
        }}
      />
      {rollCameras.length > 0 && (
        <BrowseSection
          title="Cameras"
          options={rollCameras}
          chosen={filter.camera}
          choose={(camera) => {
            choose({ ...everyRoll, camera });
          }}
        />
      )}
      {rollFilms.length > 0 && (
        <BrowseSection
          title="Film stocks"
          options={rollFilms}
          chosen={filter.film}
          choose={(film) => {
            choose({ ...everyRoll, film });
          }}
        />
      )}
    </aside>
  );
}
