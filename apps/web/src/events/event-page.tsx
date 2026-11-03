import type { ApiClient } from '@filmfile/contracts/client';
import type { Frame, Roll } from '@filmfile/contracts/rolls';
import { useQuery } from '@tanstack/react-query';
import { cameraName, useCameras } from '../equipment/use-cameras.ts';
import { filmStockName, useFilmStocks } from '../equipment/use-film-stocks.ts';
import { lensName, useLenses } from '../equipment/use-lenses.ts';
import { formatShot } from '../rolls/format-shot.ts';
import { inFrameOrder } from '../rolls/frame-order.ts';
import { Thumbnail } from '../rolls/thumbnail.tsx';
import { Link, navigate, useSearch } from '../routing.tsx';

/** How the event's frames are grouped, kept in the address as `?group=`. */
type Grouping = 'none' | 'roll' | 'camera' | 'lens' | 'film';

const groupings: readonly { value: Grouping; label: string }[] = [
  { value: 'none', label: 'Nothing' },
  { value: 'roll', label: 'Roll' },
  { value: 'camera', label: 'Camera' },
  { value: 'lens', label: 'Lens' },
  { value: 'film', label: 'Film stock' },
];

function groupingOf(value: string | null): Grouping {
  return groupings.find((g) => g.value === value)?.value ?? 'none';
}

class EventNotFound extends Error {}

function frameCount(count: number): string {
  return count === 1 ? '1 frame' : `${String(count)} frames`;
}

/** A frame with the roll it's on. */
interface RollFrame {
  readonly roll: Roll;
  readonly frame: Frame;
}

/** Rolls in shot order: by date shot, undated last, then by roll number. */
function inShotOrder(rolls: readonly Roll[]): Roll[] {
  return [...rolls].sort((a, b) => {
    if (a.shot !== b.shot) {
      if (a.shot === null || b.shot === null) {
        return a.shot === null ? 1 : -1;
      }
      return a.shot.localeCompare(b.shot);
    }
    return a.roll.localeCompare(b.roll);
  });
}

interface FrameGroup {
  /** The group's heading, or undefined when not grouping. */
  readonly title: string | undefined;
  /** The roll the group is, when grouping by roll. */
  readonly roll?: Roll;
  readonly frames: RollFrame[];
}

/** Frames under each title, keeping their order, in the order titles first appear. */
function groupedBy(
  frames: readonly RollFrame[],
  titleOf: (frame: RollFrame) => string,
): FrameGroup[] {
  const groups = new Map<string, RollFrame[]>();
  for (const frame of frames) {
    const title = titleOf(frame);
    groups.set(title, [...(groups.get(title) ?? []), frame]);
  }
  return [...groups].map(([title, members]) => ({ title, frames: members }));
}

/** Groups by name, in name order, with frames that have none last. */
function namedGroups(
  frames: readonly RollFrame[],
  nameOf: (roll: Roll) => string | undefined,
  none: string,
): FrameGroup[] {
  return groupedBy(frames, ({ roll }) => nameOf(roll) ?? none).sort((a, b) => {
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
 * An event, seen as its frames (D33): one contact sheet of every frame from
 * its rolls, in shot order, which can be grouped by roll or by what the
 * frames were shot with.
 */
export function EventPage({
  api,
  slug,
}: {
  readonly api: ApiClient;
  readonly slug: string;
}) {
  const group = groupingOf(new URLSearchParams(useSearch()).get('group'));
  const cameras = useCameras(api);
  const films = useFilmStocks(api);
  const lenses = useLenses(api);
  const event = useQuery({
    queryKey: ['events', slug],
    queryFn: async () => {
      const { data, response } = await api.GET('/api/events/{slug}', {
        params: { path: { slug } },
      });
      if (data !== undefined) {
        return data;
      }
      throw response.status === 404
        ? new EventNotFound()
        : new Error("Couldn't load the event.");
    },
  });
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

  if (event.isPending || rolls.isPending) {
    return <p>Loading the event…</p>;
  }
  if (event.isError || rolls.isError) {
    return (
      <p>
        {event.error instanceof EventNotFound
          ? 'There is no such event.'
          : "Couldn't load the event. Is the service running?"}{' '}
        <Link to="/events">All events</Link>
      </p>
    );
  }

  const frames: RollFrame[] = inShotOrder(
    rolls.data.rolls.filter((roll) => roll.event === slug),
  ).flatMap((roll) =>
    inFrameOrder(roll.frames).map((frame) => ({ roll, frame })),
  );
  const groups: FrameGroup[] = (() => {
    switch (group) {
      case 'none':
        return [{ title: undefined, frames }];
      case 'roll':
        return groupedBy(frames, ({ roll }) => roll.id).map((g) => ({
          ...g,
          title: g.frames[0]?.roll.roll,
          ...(g.frames[0] === undefined ? {} : { roll: g.frames[0].roll }),
        }));
      case 'camera':
        return namedGroups(
          frames,
          (roll) => cameraName(cameras, roll.camera),
          'No camera',
        );
      case 'lens':
        return namedGroups(
          frames,
          (roll) => lensName(lenses, roll.lens),
          'No lens',
        );
      case 'film':
        return namedGroups(
          frames,
          (roll) => filmStockName(films, roll.film),
          'No film stock',
        );
    }
  })();

  return (
    <section>
      <div className="page-heading">
        <div className="roll-title">
          <Link to="/events">Events</Link>
          <span className="muted" aria-hidden="true">
            /
          </span>
          <h1>{event.data.name}</h1>
          {event.data.date !== null && (
            <span className="muted">{formatShot(event.data.date)}</span>
          )}
          <span className="muted">{frameCount(frames.length)}</span>
        </div>
        <label className="group-by">
          Group by
          <select
            value={group}
            onChange={(change) => {
              const chosen = groupingOf(change.target.value);
              navigate(
                chosen === 'none'
                  ? `/events/${slug}`
                  : `/events/${slug}?group=${chosen}`,
              );
            }}
          >
            {groupings.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {frames.length === 0 ? (
        <p>No frames yet. Put rolls in this event from their details.</p>
      ) : (
        groups.map((g) => (
          <section key={g.title ?? 'all'} className="roll-group">
            {g.title !== undefined && (
              <h2>
                {g.roll === undefined ? (
                  g.title
                ) : (
                  <Link to={`/rolls/${g.roll.id}`} className="roll-number">
                    {g.title}
                  </Link>
                )}{' '}
                <span className="muted">{frameCount(g.frames.length)}</span>
              </h2>
            )}
            <ol className="contact-sheet" aria-label="Frames">
              {g.frames.map(({ roll, frame }) => (
                <li
                  key={`${roll.id}-${frame.id}`}
                  aria-label={`Frame ${frame.number ?? 'with no number'} of roll ${roll.roll}`}
                >
                  <Thumbnail rollId={roll.id} frame={frame} />
                  <span className="frame-caption">
                    <span className="frame-number">{frame.number ?? '—'}</span>
                    <span className="muted numbers">{roll.roll}</span>
                  </span>
                </li>
              ))}
            </ol>
          </section>
        ))
      )}
    </section>
  );
}
