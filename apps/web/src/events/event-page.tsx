import type { ApiClient } from '@filmfile/contracts/client';
import { formatShot } from '../rolls/format-shot.ts';
import { Thumbnail } from '../rolls/thumbnail.tsx';
import { Link, navigate, useSearch } from '../routing.tsx';
import { groupingOf, groupings, useEventFrames } from './event-frames.ts';

function frameCount(count: number): string {
  return count === 1 ? '1 frame' : `${String(count)} frames`;
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
  const shown = useEventFrames(api, slug, group);

  switch (shown.status) {
    case 'loading':
      return <p>Loading the event…</p>;
    case 'not-found':
    case 'failed':
      return (
        <p>
          {shown.status === 'not-found'
            ? 'There is no such event.'
            : "Couldn't load the event. Is the service running?"}{' '}
          <Link to="/events">All events</Link>
        </p>
      );
    case 'loaded':
      break;
  }
  const { event, frames, groups } = shown;
  // Frames open in the frame view, keeping the grouping, so it steps through them in the same order.
  const grouping = group === 'none' ? '' : `?group=${group}`;

  return (
    <section>
      <div className="page-heading">
        <div className="roll-title">
          <Link to="/events" className="breadcrumb">
            Events
          </Link>
          <span className="breadcrumb-separator" aria-hidden="true">
            /
          </span>
          <h1>{event.name}</h1>
          {event.date !== null && (
            <span className="muted">{formatShot(event.date)}</span>
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
                  <Link
                    to={`/events/${slug}/frames/${frame.id}${grouping}`}
                    aria-label={`Open frame ${frame.number ?? 'with no number'} of roll ${roll.roll}`}
                  >
                    <Thumbnail rollId={roll.id} frame={frame} />
                  </Link>
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
