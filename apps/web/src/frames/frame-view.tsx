import type { Frame, Roll } from '@filmfile/contracts/rolls';
import { useEffect, useRef } from 'react';
import { Thumbnail } from '../rolls/thumbnail.tsx';
import { Link, navigate } from '../routing.tsx';

/** A frame in the collection being stepped through, with the roll it's on. */
export interface CollectionFrame {
  readonly roll: Roll;
  readonly frame: Frame;
}

/** Whether a key press was meant for a field rather than for the frame view. */
function typing(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  );
}

/**
 * One frame, large, with a filmstrip of the collection it was opened from
 * (a roll, or an event's frames) to step through: by the arrows on screen,
 * the ← and → keys, or a click on the filmstrip. Esc goes back.
 */
export function FrameView({
  frames,
  current,
  back,
  addressOf,
  labelOf,
}: {
  readonly frames: readonly CollectionFrame[];
  /** The index of the frame shown. */
  readonly current: number;
  /** Where the frame was opened from, to go back to. */
  readonly back: { readonly to: string; readonly label: string };
  /** A frame's own address in this collection. */
  readonly addressOf: (frame: CollectionFrame) => string;
  /** A frame as the filmstrip names it, e.g. "Frame 12". */
  readonly labelOf: (frame: CollectionFrame) => string;
}) {
  const shown = frames[current];
  const previous = frames[current - 1];
  const next = frames[current + 1];
  const currentInStrip = useRef<HTMLLIElement>(null);

  useEffect(() => {
    // happy-dom, which the page tests run in, has no scrollIntoView, though
    // its types say every element does.
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    currentInStrip.current?.scrollIntoView?.({
      block: 'nearest',
      inline: 'center',
    });
  }, [current]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        typing(event.target)
      ) {
        return;
      }
      // Stepping replaces the address, so Back still leaves the frame view.
      if (event.key === 'ArrowLeft' && previous !== undefined) {
        navigate(addressOf(previous), { replace: true });
      } else if (event.key === 'ArrowRight' && next !== undefined) {
        navigate(addressOf(next), { replace: true });
      } else if (event.key === 'Escape') {
        navigate(back.to);
      } else {
        return;
      }
      event.preventDefault();
    }
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [previous, next, back.to, addressOf]);

  if (shown === undefined) {
    return (
      <p>
        There is no such frame. <Link to={back.to}>{back.label}</Link>
      </p>
    );
  }

  return (
    <section className="frame-view">
      <div className="frame-view-bar">
        <Link to={back.to}>{back.label}</Link>
        <h1>Frame {shown.frame.number ?? 'with no number'}</h1>
        <span className="muted numbers">{shown.roll.roll}</span>
        <span className="muted">
          {current + 1} of {frames.length}
        </span>
      </div>

      <div className="frame-view-stage">
        <button
          type="button"
          className="frame-step"
          aria-label="Previous frame"
          disabled={previous === undefined}
          onClick={() => {
            if (previous !== undefined) {
              navigate(addressOf(previous), { replace: true });
            }
          }}
        >
          ‹
        </button>
        <div className="frame-view-image">
          <Thumbnail rollId={shown.roll.id} frame={shown.frame} size="large" />
        </div>
        <button
          type="button"
          className="frame-step"
          aria-label="Next frame"
          disabled={next === undefined}
          onClick={() => {
            if (next !== undefined) {
              navigate(addressOf(next), { replace: true });
            }
          }}
        >
          ›
        </button>
      </div>

      <ol className="filmstrip" aria-label="Filmstrip">
        {frames.map((item, i) => (
          <li
            key={`${item.roll.id}-${item.frame.id}`}
            ref={i === current ? currentInStrip : undefined}
          >
            <Link
              to={addressOf(item)}
              replace
              aria-label={labelOf(item)}
              {...(i === current ? { 'aria-current': 'true' } : {})}
            >
              <Thumbnail rollId={item.roll.id} frame={item.frame} decorative />
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
