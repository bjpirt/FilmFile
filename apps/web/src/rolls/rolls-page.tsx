import type { ApiClient } from '@filmfile/contracts/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Roll } from '@filmfile/contracts/rolls';
import { useEffect, useState, type SubmitEvent } from 'react';
import { navigate, useSearch } from '../routing.tsx';
import { BrowsePanel } from './browse-panel.tsx';
import { RollCard } from './roll-card.tsx';
import { RollTable } from './roll-table.tsx';
import {
  addressOf,
  readAddress,
  type Grouping,
  type RollsAddress,
} from './rolls-address.ts';
import {
  rememberedView,
  rememberView,
  type RollsView,
} from './view-preference.ts';

function rollCount(count: number): string {
  return count === 1 ? '1 roll' : `${String(count)} rolls`;
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
  const queryClient = useQueryClient();
  // The roll number being typed, while New roll is open.
  const [newRoll, setNewRoll] = useState<string | undefined>(undefined);
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

  const createRoll = useMutation({
    mutationFn: async (roll: string) => {
      const { data, response } = await api.POST('/api/rolls', {
        body: { roll },
      });
      if (data !== undefined) {
        return data;
      }
      switch (response.status) {
        case 409:
          throw new Error(`Roll ${roll} already exists.`);
        case 422:
          throw new Error(
            'Enter a roll number like 2026-014: the year it was shot, then three digits.',
          );
        default:
          throw new Error("Couldn't create the roll. Is the service running?");
      }
    },
    onSuccess: async () => {
      setNewRoll(undefined);
      await queryClient.invalidateQueries({ queryKey: ['rolls'] });
    },
  });

  function submit(event: SubmitEvent) {
    event.preventDefault();
    createRoll.mutate((newRoll ?? '').trim());
  }

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
          {newRoll === undefined && (
            <button
              type="button"
              className="primary"
              onClick={() => {
                setNewRoll('');
              }}
            >
              New roll
            </button>
          )}
        </div>

        {newRoll !== undefined && (
          <form className="new-roll" onSubmit={submit}>
            <label htmlFor="roll-number">Roll number</label>
            <input
              id="roll-number"
              value={newRoll}
              placeholder="2026-014"
              autoFocus
              onChange={(event) => {
                setNewRoll(event.target.value);
              }}
            />
            <button
              type="submit"
              className="primary"
              disabled={createRoll.isPending}
            >
              Create roll
            </button>
            <button
              type="button"
              onClick={() => {
                createRoll.reset();
                setNewRoll(undefined);
              }}
            >
              Cancel
            </button>
            {createRoll.isError && (
              <p role="alert">{createRoll.error.message}</p>
            )}
          </form>
        )}

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
        {grouped(shown, address.group).map((group) => (
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
