import type { ApiClient } from '@filmfile/contracts/client';
import { useQuery } from '@tanstack/react-query';
import type { Roll } from '@filmfile/contracts/rolls';
import { useEffect } from 'react';
import { Link, navigate, useSearch } from '../routing.tsx';
import { BrowsePanel } from './browse-panel.tsx';
import { RollCard } from './roll-card.tsx';
import { RollTable } from './roll-table.tsx';
import {
  addressOf,
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

/** The rolls in groups, each with its heading; one untitled group when not grouping. */
function grouped(
  rolls: readonly Roll[],
  group: Grouping,
): { title: string | undefined; rolls: Roll[] }[] {
  if (group === 'none') {
    return [{ title: undefined, rolls: [...rolls] }];
  }
  const years = [...new Set(rolls.map((roll) => roll.roll.slice(0, 4)))].sort(
    (a, b) => b.localeCompare(a),
  );
  return years.map((year) => ({
    title: year,
    rolls: rolls.filter((roll) => roll.roll.startsWith(year)),
  }));
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
  const shown =
    address.year === undefined
      ? all
      : all.filter((roll) => roll.roll.startsWith(address.year ?? ''));

  return (
    <div className="rolls-layout">
      {browseOpen && rolls.data !== undefined && (
        <BrowsePanel
          rolls={all}
          year={address.year}
          choose={(year) => {
            go({ year });
          }}
        />
      )}
      <section className="rolls-content">
        <div className="page-heading">
          <div className="rolls-title">
            <h1>
              {address.year === undefined
                ? 'Rolls'
                : `Rolls from ${address.year}`}
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
                go({ group: event.target.value === 'year' ? 'year' : 'none' });
              }}
            >
              <option value="none">Nothing</option>
              <option value="year">Year</option>
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
        {grouped(sorted(shown, address.sort), address.group).map((group) => (
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
                    <RollCard key={roll.id} roll={roll} />
                  ))}
                </ul>
              ) : (
                <RollTable rolls={group.rolls} />
              ))}
          </section>
        ))}
      </section>
    </div>
  );
}
