import { useEffect, useId, useRef, useState } from 'react';
import { isGrouping, type Grouping } from './rolls-address.ts';

/** Which rolls are grouped under what, and the order within; for the "View options" panel. */
export interface ViewChoices {
  readonly group: Grouping;
  readonly sort: 'number' | 'shot';
}

/**
 * "View options ▾": a panel with Group by and Sort by (FF-160), set less
 * often than the layout, which has its own icons beside it. It stays open
 * while they're changed, and closes on Esc or a click elsewhere.
 */
export function ViewOptions({
  choices,
  change,
}: {
  readonly choices: ViewChoices;
  readonly change: (changes: Partial<ViewChoices>) => void;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const whole = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onPointerDown(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !whole.current?.contains(event.target)
      ) {
        setOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        button.current?.focus();
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="view-options" ref={whole}>
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => {
          setOpen(!open);
        }}
      >
        View options
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div
          id={panelId}
          role="group"
          aria-label="View options"
          className="view-options-panel"
        >
          <label>
            Group by
            <select
              value={choices.group}
              onChange={(event) => {
                const group = event.target.value;
                change({ group: isGrouping(group) ? group : 'none' });
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
          <label>
            Sort by
            <select
              value={choices.sort}
              onChange={(event) => {
                change({
                  sort: event.target.value === 'shot' ? 'shot' : 'number',
                });
              }}
            >
              <option value="number">Roll number</option>
              <option value="shot">Date shot</option>
            </select>
          </label>
        </div>
      )}
    </div>
  );
}
