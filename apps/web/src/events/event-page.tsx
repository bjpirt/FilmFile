import type { ApiClient } from '@filmfile/contracts/client';
import { useEffect, useState } from 'react';
import { ExportDialog } from '../exports/export-dialog.tsx';
import { formatShot } from '../rolls/format-shot.ts';
import { FrameMarks } from '../rolls/frame-marks.tsx';
import { useRateFrame } from '../rolls/use-rate-frame.ts';
import { Thumbnail } from '../rolls/thumbnail.tsx';
import { Link, navigate, useSearch } from '../routing.tsx';
import { EventEditor } from './event-editor.tsx';
import { MenuButton } from '../menu-button.tsx';
import { showingHidden } from '../rolls/hidden-frames.ts';
import {
  noSelection,
  selectAll,
  selectionCount,
  toggle,
  type Selection,
} from '../rolls/selection.ts';
import {
  eventQuery,
  groupingOf,
  groupings,
  useEventFrames,
} from './event-frames.ts';

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
  const showHidden = showingHidden(useSearch());
  const shown = useEventFrames(api, slug, group, showHidden);
  const ratings = useRateFrame(api);
  const [editing, setEditing] = useState(false);
  // Selecting frames, to export together; undefined when not.
  const [selection, setSelection] = useState<Selection | undefined>(undefined);
  const [exporting, setExporting] = useState(false);

  // Esc closes the Export dialog, or else leaves Select mode.
  useEffect(() => {
    if (selection === undefined) {
      return;
    }
    function onKey(event: KeyboardEvent) {
      if (event.key !== 'Escape') {
        return;
      }
      if (exporting) {
        setExporting(false);
      } else {
        setSelection(undefined);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [selection, exporting]);

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
  const { event, frames, groups, hidden } = shown;
  // Frames open in the frame view, keeping the grouping, so it steps through them in the same order.
  const grouping = eventQuery(group, showHidden);
  // The frames in the order the page shows them, which a shift-click runs along.
  const inOrder = groups.flatMap((g) => g.frames);
  const order = inOrder.map(({ frame }) => frame.id);
  const pick = (id: string, shift: boolean) => {
    setSelection((current) => current && toggle(current, order, id, shift));
  };

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
          <span className="muted">
            {frameCount(frames.length)}
            {hidden > 0 && ` (${String(hidden)} hidden)`}
          </span>
        </div>
        <div className="page-actions">
          {hidden > 0 && (
            <MenuButton
              label="Actions"
              items={[
                {
                  label: showHidden
                    ? 'Hide hidden frames'
                    : 'Show hidden frames',
                  select: () => {
                    navigate(
                      `/events/${slug}${eventQuery(group, !showHidden)}`,
                    );
                  },
                },
              ]}
            />
          )}
          {selection === undefined && frames.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setSelection(noSelection);
              }}
            >
              Select
            </button>
          )}
          {!editing && (
            <button
              type="button"
              aria-label={`Edit ${event.name}`}
              onClick={() => {
                setEditing(true);
              }}
            >
              Edit
            </button>
          )}
        </div>
        <label className="group-by">
          Group by
          <select
            value={group}
            onChange={(change) => {
              const chosen = groupingOf(change.target.value);
              navigate(`/events/${slug}${eventQuery(chosen, showHidden)}`);
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

      {editing && (
        <EventEditor
          api={api}
          slug={slug}
          close={() => {
            setEditing(false);
          }}
        />
      )}

      {selection !== undefined && (
        <div className="sheet-controls selection-bar">
          <p role="status" aria-label="Selection">
            {selectionCount(selection)}
          </p>
          <button
            type="button"
            onClick={() => {
              setSelection(selectAll(order));
            }}
          >
            Select all
          </button>
          <button
            type="button"
            onClick={() => {
              setSelection(noSelection);
            }}
          >
            Clear
          </button>
          <button
            type="button"
            disabled={selection.selected.size === 0}
            onClick={() => {
              setExporting(!exporting);
            }}
          >
            Export…
          </button>
          <button
            type="button"
            className="primary"
            onClick={() => {
              setExporting(false);
              setSelection(undefined);
            }}
          >
            Done
          </button>
          {exporting && (
            <ExportDialog
              api={api}
              items={inOrder.filter(({ frame }) =>
                selection.selected.has(frame.id),
              )}
              zipName={event.name}
              close={() => {
                setExporting(false);
              }}
            />
          )}
        </div>
      )}

      {ratings.problem !== undefined && <p role="alert">{ratings.problem}</p>}

      {frames.length === 0 && hidden > 0 ? (
        <p>
          {String(hidden)} hidden.{' '}
          <Link to={`/events/${slug}${eventQuery(group, true)}`}>
            Show hidden frames
          </Link>
        </p>
      ) : frames.length === 0 ? (
        <p>No frames yet. Put rolls in this event from their details.</p>
      ) : (
        groups.map((g) => (
          <section key={g.title ?? 'all'} className="roll-group">
            {g.title !== undefined && (
              <h2>
                {g.roll !== undefined ? (
                  <Link to={`/rolls/${g.roll.id}`} className="roll-number">
                    {g.title}
                  </Link>
                ) : g.rollsLink !== undefined ? (
                  <Link to={g.rollsLink}>{g.title}</Link>
                ) : (
                  g.title
                )}{' '}
                <span className="muted">{frameCount(g.frames.length)}</span>
              </h2>
            )}
            <ol className="contact-sheet" aria-label="Frames">
              {g.frames.map(({ roll, frame }) => (
                <li
                  key={`${roll.id}-${frame.id}`}
                  className={frame.hidden ? 'hidden-frame' : undefined}
                  aria-label={`Frame ${frame.number ?? 'with no number'} of roll ${roll.roll}`}
                >
                  <div className="frame-picture">
                    {selection === undefined ? (
                      <Link
                        to={`/events/${slug}/frames/${frame.id}${grouping}`}
                        aria-label={`Open frame ${frame.number ?? 'with no number'} of roll ${roll.roll}`}
                      >
                        <Thumbnail rollId={roll.id} frame={frame} />
                      </Link>
                    ) : (
                      <>
                        {/* The picture toggles too, for the mouse; the checkbox is what the keyboard and screen readers use. */}
                        <div
                          className="selectable"
                          onClick={(click) => {
                            pick(frame.id, click.shiftKey);
                          }}
                        >
                          <Thumbnail rollId={roll.id} frame={frame} />
                        </div>
                        <input
                          type="checkbox"
                          className="frame-select"
                          aria-label={`Select frame ${frame.number ?? 'with no number'} of roll ${roll.roll}`}
                          checked={selection.selected.has(frame.id)}
                          onChange={(change) => {
                            pick(
                              frame.id,
                              'shiftKey' in change.nativeEvent &&
                                change.nativeEvent.shiftKey === true,
                            );
                          }}
                        />
                      </>
                    )}
                    <FrameMarks
                      frame={frame}
                      roll={roll}
                      stars={selection === undefined}
                      {...(selection === undefined
                        ? {
                            rate: (rating: number | null) => {
                              ratings.rate(
                                roll.id,
                                frame.id,
                                rating,
                                frame.rating,
                              );
                            },
                            hide: (hide: boolean) => {
                              ratings.hide(
                                roll.id,
                                frame.id,
                                hide,
                                `frame ${frame.number ?? 'with no number'}`,
                              );
                            },
                          }
                        : {})}
                    />
                  </div>
                  <span className="frame-caption">
                    <span className="frame-number">{frame.number ?? '—'}</span>
                    <Link to={`/rolls/${roll.id}`} className="muted numbers">
                      {roll.roll}
                    </Link>
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
