import type { ApiClient } from '@filmfile/contracts/client';
import { useQuery } from '@tanstack/react-query';
import type { Roll } from '@filmfile/contracts/rolls';
import type { UnreadableRoll } from '@filmfile/contracts/rolls';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { cameraName, useCameras } from '../equipment/use-cameras.ts';
import { filmStockName, useFilmStocks } from '../equipment/use-film-stocks.ts';
import { lensName, useLenses } from '../equipment/use-lenses.ts';
import { eventName, useEvents } from '../events/use-events.ts';
import { firstIssueMessage } from '../forms/first-issue-message.ts';
import { Link, navigate, useSearch } from '../routing.tsx';
import { BrowsePanel } from './browse-panel.tsx';
import { useRollNumberPattern } from './use-roll-number-pattern.ts';
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
import { eventsOfRoll } from '../events/frame-events.ts';
import {
  numberingPreview,
  type NumberingSnapshotRoll,
  type ProposedRollNumber,
} from './numbering-preview.ts';

interface NumberingPreviewState {
  readonly snapshot: readonly NumberingSnapshotRoll[];
  readonly unreadable: readonly UnreadableRoll[];
  readonly changes: readonly ProposedRollNumber[];
}

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

/** The rolls under each of their titles, keeping their order, in the order titles first appear. A roll with several titles is under each. */
function groupedBy(
  rolls: readonly Roll[],
  titlesOf: (roll: Roll) => readonly string[],
): RollGroup[] {
  const groups = new Map<string, Roll[]>();
  for (const roll of rolls) {
    for (const title of titlesOf(roll)) {
      groups.set(title, [...(groups.get(title) ?? []), roll]);
    }
  }
  return [...groups].map(([title, members]) => ({ title, rolls: members }));
}

/** Names in order, ignoring case, with numbers by value. */
function byName(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true });
}

/** Groups titled by name, in name order (or the order given), with the group of rolls that have none last. */
function namedGroups(
  rolls: readonly Roll[],
  namesOf: (roll: Roll) => readonly (string | undefined)[],
  none: string,
  order: (a: string, b: string) => number = byName,
): RollGroup[] {
  return groupedBy(rolls, (roll) => {
    const names = namesOf(roll).filter((name) => name !== undefined);
    return names.length === 0 ? [none] : names;
  }).sort((a, b) => {
    if (a.title === none || b.title === none) {
      return a.title === none ? 1 : -1;
    }
    return order(a.title ?? '', b.title ?? '');
  });
}

/** What each event, camera, film stock and lens a roll has is called, by slug. */
interface Names {
  readonly event: (slug: string | null) => string | undefined;
  /** Orders events by name as the events list does: newest first (D32). */
  readonly eventOrder: (a: string, b: string) => number;
  readonly camera: (slug: string | null) => string | undefined;
  readonly film: (slug: string | null) => string | undefined;
  readonly lens: (slug: string | null) => string | undefined;
}

/**
 * The rolls in groups, each with its heading; one untitled group when not
 * grouping. Years go newest first; events, cameras, film stocks and lenses
 * by name, with rolls that have none last.
 */
function grouped(
  rolls: readonly Roll[],
  group: Grouping,
  names: Names,
): RollGroup[] {
  switch (group) {
    case 'none':
      return [{ title: undefined, rolls: [...rolls] }];
    case 'year':
      return groupedBy(rolls, (roll) => [
        roll.shot?.slice(0, 4) ?? 'No shot year',
      ]).sort((a, b) => {
        if (a.title === 'No shot year' || b.title === 'No shot year') {
          return a.title === 'No shot year' ? 1 : -1;
        }
        return (b.title ?? '').localeCompare(a.title ?? '');
      });
    case 'event':
      return namedGroups(
        rolls,
        // Under every event it's in, through its frames too (U17).
        (roll) => eventsOfRoll(roll).map((slug) => names.event(slug)),
        'No event',
        names.eventOrder,
      );
    case 'camera':
      return namedGroups(
        rolls,
        (roll) => [names.camera(roll.camera)],
        'No camera',
      );
    case 'film':
      return namedGroups(
        rolls,
        (roll) => [names.film(roll.film)],
        'No film stock',
      );
    case 'lens':
      return namedGroups(rolls, (roll) => [names.lens(roll.lens)], 'No lens');
  }
}

/**
 * The page's heading for the rolls chosen, e.g. "Rolls of Kodak Portra 400
 * shot on Nikon FE with Zeiss Planar 80mm f/2.8 in 2026".
 */
function headingFor({
  year,
  camera,
  film,
  lens,
}: {
  readonly year: string | undefined;
  readonly camera: string | undefined;
  readonly film: string | undefined;
  readonly lens: string | undefined;
}): string {
  const of = film === undefined ? '' : ` of ${film}`;
  const shot =
    camera === undefined && lens === undefined
      ? ''
      : [
          ' shot',
          camera === undefined ? '' : ` on ${camera}`,
          lens === undefined ? '' : ` with ${lens}`,
        ].join('');
  const when =
    year === undefined
      ? ''
      : of === '' && shot === ''
        ? ` from ${year}`
        : ` in ${year}`;
  return `Rolls${of}${shot}${when}`;
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
  const queryClient = useQueryClient();
  const pattern = useRollNumberPattern(api);
  const [numbering, setNumbering] = useState<NumberingPreviewState>();
  const [numberingBusy, setNumberingBusy] = useState(false);
  const [numberingError, setNumberingError] = useState<string>();
  const [numberingMessage, setNumberingMessage] = useState<string>();
  const filterKey = JSON.stringify([
    address.year,
    address.camera,
    address.film,
    address.lens,
  ]);
  const currentFilterKey = useRef(filterKey);
  currentFilterKey.current = filterKey;

  // Every history entry records its view, so back and forward bring it back
  // rather than whichever view was chosen last.
  useEffect(() => {
    if (address.view === undefined) {
      navigate(addressOf({ ...address, view }), { replace: true });
    }
  }, [address, view]);

  useEffect(() => {
    setNumbering(undefined);
    setNumberingError(undefined);
    setNumberingMessage(undefined);
  }, [address.year, address.camera, address.film, address.lens]);

  function go(change: Partial<RollsAddress>) {
    navigate(addressOf({ ...address, view, ...change }));
  }

  function show(chosen: RollsView) {
    rememberView(chosen);
    go({ view: chosen });
  }

  const cameras = useCameras(api);
  const films = useFilmStocks(api);
  const lenses = useLenses(api);
  const events = useEvents(api);
  const names: Names = {
    event: (slug) => eventName(events, slug),
    eventOrder: (a, b) =>
      events.findIndex((e) => e.name === a) -
      events.findIndex((e) => e.name === b),
    camera: (slug) => cameraName(cameras, slug),
    film: (slug) => filmStockName(films, slug),
    lens: (slug) => lensName(lenses, slug),
  };
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

  async function startNumberingPreview() {
    const requestedFilterKey = filterKey;
    setNumberingBusy(true);
    setNumberingError(undefined);
    setNumberingMessage(undefined);
    try {
      const { data, response } = await api.GET('/api/rolls/numbering');
      if (response.status !== 200 || data === undefined) {
        setNumberingError("Couldn't load the rolls for numbering.");
        return;
      }
      if (currentFilterKey.current !== requestedFilterKey) {
        return;
      }
      queryClient.setQueryData(['rolls'], {
        rolls: data.rolls.map(({ roll }) => roll),
        unreadable: data.unreadable,
      });
      const proposed = numberingPreview(
        data.rolls,
        data.unreadable,
        {
          year: address.year,
          camera: address.camera,
          film: address.film,
          lens: address.lens,
        },
        pattern,
      );
      if (!proposed.ok) {
        setNumberingError(
          proposed.kind === 'missing-shot-year'
            ? 'A roll needs a shot year before it can be numbered.'
            : `A roll needs ${proposed.missing} before it can be numbered with your roll number pattern.`,
        );
        return;
      }
      setNumbering({
        snapshot: data.rolls,
        unreadable: data.unreadable,
        changes: proposed.changes,
      });
    } catch {
      setNumberingError("Couldn't load the rolls for numbering.");
    } finally {
      setNumberingBusy(false);
    }
  }

  async function applyNumbering() {
    if (numbering === undefined || numbering.changes.length === 0) {
      return;
    }
    setNumberingBusy(true);
    setNumberingError(undefined);
    setNumberingMessage(undefined);
    try {
      const { response, error } = await api.POST('/api/rolls/numbering', {
        body: {
          snapshot: numbering.snapshot.map(({ roll, version }) => ({
            id: roll.id,
            version,
          })),
          unreadable: [...numbering.unreadable],
          changes: [...numbering.changes],
        },
      });
      if (response.status === 204) {
        setNumbering(undefined);
        setNumberingMessage('Roll numbers updated.');
        await queryClient.invalidateQueries({ queryKey: ['rolls'] });
        return;
      }
      if (response.status === 409) {
        setNumbering(undefined);
        setNumberingError(
          'Some rolls changed since you previewed the numbers. Nothing was changed. Cancel and run ‘Number rolls…’ again.',
        );
        await queryClient.invalidateQueries({ queryKey: ['rolls'] });
        return;
      }
      setNumberingError(
        firstIssueMessage(error) ?? "Couldn't number the rolls.",
      );
    } catch {
      setNumberingError("Couldn't number the rolls. Try again.");
    } finally {
      setNumberingBusy(false);
    }
  }

  const all = rolls.data?.rolls ?? [];
  const proposedNumbers = new Map(
    numbering?.changes.map(({ id, roll }) => [id, roll]) ?? [],
  );
  const shown = all.filter(
    (roll) =>
      (address.year === undefined ||
        roll.shot?.startsWith(address.year) === true) &&
      (address.camera === undefined || roll.camera === address.camera) &&
      (address.film === undefined || roll.film === address.film) &&
      (address.lens === undefined || roll.lens === address.lens),
  );

  return (
    <div className="rolls-layout">
      {browseOpen && rolls.data !== undefined && (
        <BrowsePanel
          rolls={all}
          cameras={cameras}
          films={films}
          lenses={lenses}
          events={events}
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
                camera: names.camera(address.camera ?? null),
                film: names.film(address.film ?? null),
                lens: names.lens(address.lens ?? null),
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
              <option value="event">Event</option>
              <option value="camera">Camera</option>
              <option value="lens">Lens</option>
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
          <button
            type="button"
            disabled={numberingBusy}
            onClick={() => {
              void startNumberingPreview();
            }}
          >
            {numberingBusy && numbering === undefined
              ? 'Preparing preview…'
              : 'Number rolls…'}
          </button>
          {numbering !== undefined && (
            <>
              {numbering.changes.length > 0 && (
                <button
                  type="button"
                  disabled={numberingBusy}
                  onClick={() => {
                    void applyNumbering();
                  }}
                >
                  Apply
                </button>
              )}
              <button
                type="button"
                disabled={numberingBusy}
                onClick={() => {
                  setNumbering(undefined);
                  setNumberingError(undefined);
                  setNumberingMessage(undefined);
                }}
              >
                Cancel
              </button>
            </>
          )}
          <Link to="/rolls/import" className="button">
            Import rolls…
          </Link>
          <Link to="/rolls/new" className="button primary">
            New roll
          </Link>
        </div>

        {numberingError !== undefined && <p role="alert">{numberingError}</p>}
        {numberingMessage !== undefined && (
          <p role="status">{numberingMessage}</p>
        )}
        {numbering?.changes.length === 0 && (
          <p role="status">The rolls are in order.</p>
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
        {grouped(sorted(shown, address.sort), address.group, names).map(
          (group) => (
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
                        events={events}
                        proposedNumber={proposedNumbers.get(roll.id)}
                      />
                    ))}
                  </ul>
                ) : (
                  <RollTable
                    rolls={group.rolls}
                    cameras={cameras}
                    films={films}
                    events={events}
                    proposedNumbers={proposedNumbers}
                  />
                ))}
            </section>
          ),
        )}
      </section>
    </div>
  );
}
