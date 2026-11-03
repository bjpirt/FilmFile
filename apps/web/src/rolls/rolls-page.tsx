import type { ApiClient } from '@filmfile/contracts/client';
import { useQuery } from '@tanstack/react-query';
import type { Camera, FilmStock } from '@filmfile/contracts/equipment';
import type { Roll } from '@filmfile/contracts/rolls';
import { useEffect } from 'react';
import { cameraName, useCameras } from '../equipment/use-cameras.ts';
import { filmStockName, useFilmStocks } from '../equipment/use-film-stocks.ts';
import { Link, navigate, useSearch } from '../routing.tsx';
import { BrowsePanel } from './browse-panel.tsx';
import { RollCard } from './roll-card.tsx';
import { RollTable } from './roll-table.tsx';
import {
  addressOf,
  isGrouping,
  readAddress,
  type Grouping,
  type RollsAddress,
  type Sorting,
} from './rolls-address.ts';
import {
  rememberedView,
  rememberView,
  type RollsView,
} from './view-preference.ts';

function rollCount(count: number): string {
  return count === 1 ? '1 roll' : `${String(count)} rolls`;
}

/** The rolls in the order chosen; by date shot, undated rolls go last. */
function sorted(rolls: readonly Roll[], sort: Sorting): Roll[] {
  if (sort === 'number') {
    return [...rolls];
  }
  return [...rolls].sort((a, b) => {
    if (a.shot === b.shot) {
      return a.roll.localeCompare(b.roll);
    }
    if (a.shot === null || b.shot === null) {
      return a.shot === null ? 1 : -1;
    }
    return a.shot.localeCompare(b.shot);
  });
}

interface RollGroup {
  readonly title: string | undefined;
  readonly rolls: Roll[];
}

/** The rolls under each title, keeping their order, in the order titles first appear. */
function groupedBy(
  rolls: readonly Roll[],
  titleOf: (roll: Roll) => string,
): RollGroup[] {
  const groups = new Map<string, Roll[]>();
  for (const roll of rolls) {
    const title = titleOf(roll);
    groups.set(title, [...(groups.get(title) ?? []), roll]);
  }
  return [...groups].map(([title, members]) => ({ title, rolls: members }));
}

/** Groups titled by name, in name order, with the group of rolls that have none last. */
function namedGroups(
  rolls: readonly Roll[],
  nameOf: (roll: Roll) => string | undefined,
  none: string,
): RollGroup[] {
  return groupedBy(rolls, (roll) => nameOf(roll) ?? none).sort((a, b) => {
    if (a.title === none || b.title === none) {
      return a.title === none ? 1 : -1;
    }
    return (a.title ?? '').localeCompare(b.title ?? '', undefined, {
      sensitivity: 'base',
      numeric: true,
    });
  });
}

/**
 * The rolls in groups, each with its heading; one untitled group when not
 * grouping. Years go newest first; cameras and film stocks by name, with
 * rolls that have none last.
 */
function grouped(
  rolls: readonly Roll[],
  group: Grouping,
  cameras: readonly Camera[],
  films: readonly FilmStock[],
): RollGroup[] {
  switch (group) {
    case 'none':
      return [{ title: undefined, rolls: [...rolls] }];
    case 'year':
      return groupedBy(rolls, (roll) => roll.roll.slice(0, 4)).sort((a, b) =>
        (b.title ?? '').localeCompare(a.title ?? ''),
      );
    case 'camera':
      return namedGroups(
        rolls,
        (roll) => cameraName(cameras, roll.camera),
        'No camera',
      );
    case 'film':
      return namedGroups(
        rolls,
        (roll) => filmStockName(films, roll.film),
        'No film stock',
      );
  }
}

/** The page's heading for the rolls chosen, e.g. "Rolls of Kodak Portra 400 shot on Nikon FE in 2026". */
function headingFor({
  year,
  camera,
  film,
}: {
  readonly year: string | undefined;
  readonly camera: string | undefined;
  readonly film: string | undefined;
}): string {
  const of = film === undefined ? '' : ` of ${film}`;
  const shotOn = camera === undefined ? '' : ` shot on ${camera}`;
  const when =
    year === undefined
      ? ''
      : of === '' && shotOn === ''
        ? ` from ${year}`
        : ` in ${year}`;
  return `Rolls${of}${shotOn}${when}`;
}

export function RollsPage({
  api,
  browseOpen,
}: {
  readonly api: ApiClient;
  /** Whether the browse panel is showing; its toggle is in the header. */
  readonly browseOpen: boolean;
}) {
  const address = readAddress(useSearch());
  const view = address.view ?? rememberedView();

  // Every history entry records its view, so back and forward bring it back
  // rather than whichever view was chosen last.
  useEffect(() => {
    if (address.view === undefined) {
      navigate(addressOf({ ...address, view }), { replace: true });
    }
  }, [address, view]);

  function go(change: Partial<RollsAddress>) {
    navigate(addressOf({ ...address, view, ...change }));
  }

  function show(chosen: RollsView) {
    rememberView(chosen);
    go({ view: chosen });
  }

  const cameras = useCameras(api);
  const films = useFilmStocks(api);
  const rolls = useQuery({
    queryKey: ['rolls'],
    queryFn: async () => {
      const { data } = await api.GET('/api/rolls');
      if (data === undefined) {
        throw new Error("Couldn't load the rolls.");
      }
      return data;
    },
  });

  const all = rolls.data?.rolls ?? [];
  const shown = all.filter(
    (roll) =>
      (address.year === undefined || roll.roll.startsWith(address.year)) &&
      (address.camera === undefined || roll.camera === address.camera) &&
      (address.film === undefined || roll.film === address.film),
  );

  return (
    <div className="rolls-layout">
      {browseOpen && rolls.data !== undefined && (
        <BrowsePanel
          rolls={all}
          cameras={cameras}
          films={films}
          filter={address}
          choose={(filter) => {
            go(filter);
          }}
        />
      )}
      <section className="rolls-content">
        <div className="page-heading">
          <div className="rolls-title">
            <h1>
              {headingFor({
                year: address.year,
                camera: cameraName(cameras, address.camera ?? null),
                film: filmStockName(films, address.film ?? null),
              })}
            </h1>
            {rolls.data !== undefined && (
              <span className="muted">{rollCount(shown.length)}</span>
            )}
          </div>
          <label className="group-by">
            Group by
            <select
              value={address.group}
              onChange={(event) => {
                const group = event.target.value;
                go({ group: isGrouping(group) ? group : 'none' });
              }}
            >
              <option value="none">Nothing</option>
              <option value="year">Year</option>
              <option value="camera">Camera</option>
              <option value="film">Film stock</option>
            </select>
          </label>
          <label className="group-by">
            Sort by
            <select
              value={address.sort}
              onChange={(event) => {
                go({ sort: event.target.value === 'shot' ? 'shot' : 'number' });
              }}
            >
              <option value="number">Roll number</option>
              <option value="shot">Date shot</option>
            </select>
          </label>
          <div role="group" aria-label="View" className="segmented">
            {(['grid', 'list'] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={view === option}
                onClick={() => {
                  show(option);
                }}
              >
                {option === 'grid' ? 'Grid' : 'List'}
              </button>
            ))}
          </div>
          <Link to="/rolls/new" className="button primary">
            New roll
          </Link>
        </div>

        {rolls.isPending && <p>Loading rolls…</p>}
        {rolls.isError && (
          <p>Couldn't load the rolls. Is the service running?</p>
        )}
        {rolls.data?.unreadable.map(({ folder, problem }) => (
          <p key={folder} role="alert">
            Roll {folder} can't be read: {problem}. Fix or replace its roll.json
            in the archive.
          </p>
        ))}
        {rolls.data !== undefined && all.length === 0 && <p>No rolls yet.</p>}
        {grouped(
          sorted(shown, address.sort),
          address.group,
          cameras,
          films,
        ).map((group) => (
          <section key={group.title ?? 'all'} className="roll-group">
            {group.title !== undefined && (
              <h2>
                {group.title}{' '}
                <span className="muted">{rollCount(group.rolls.length)}</span>
              </h2>
            )}
            {group.rolls.length > 0 &&
              (view === 'grid' ? (
                <ul className="roll-grid">
                  {group.rolls.map((roll) => (
                    <RollCard
                      key={roll.id}
                      roll={roll}
                      cameras={cameras}
                      films={films}
                    />
                  ))}
                </ul>
              ) : (
                <RollTable
                  rolls={group.rolls}
                  cameras={cameras}
                  films={films}
                />
              ))}
          </section>
        ))}
      </section>
    </div>
  );
}
