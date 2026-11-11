import { useState, type ReactNode, type SubmitEvent } from 'react';
import { MenuButton } from '../menu-button.tsx';

/** What selected frames are given: their own camera, lens or event, or null for their roll's (and false for no event at all, D98). Never a film stock, which is the roll's (D45). */
export interface FramesChange {
  readonly camera?: string | null;
  readonly lens?: string | null;
  readonly event?: string | null | false;
  readonly toScan?: boolean;
  readonly hidden?: boolean;
}

/** One thing to choose from, e.g. a camera by slug and label. */
export interface Choice {
  readonly value: string;
  readonly label: string;
}

const details = [
  { key: 'event', name: 'Event' },
  { key: 'camera', name: 'Camera' },
  { key: 'lens', name: 'Lens' },
] as const;

type Detail = (typeof details)[number]['key'];

// Stands for the roll's in the list; no slug can be empty.
const rollsOwn = '';
// Stands for no event in the list; no slug begins with #.
const noEvent = '#none';

function changeOf(detail: Detail, value: string): FramesChange {
  const chosen = value === rollsOwn ? null : value;
  switch (detail) {
    case 'event':
      return { event: chosen === noEvent ? false : chosen };
    case 'camera':
      return { camera: chosen };
    case 'lens':
      return { lens: chosen };
  }
}

function frames(count: number): string {
  return count === 1 ? '1 frame' : `${String(count)} frames`;
}

/**
 * The selected frames' event, camera or lens, set together (U16): a Set
 * menu of them, each opening a choice of the archive's, or the roll's, in
 * the bar's place (U56). `children` are the bar's other buttons, put away
 * while a choice is open so the bar stays one line.
 */
export function AssignToFrames({
  count,
  choices,
  apply,
  children,
}: {
  /** How many frames are selected. */
  readonly count: number;
  readonly choices: Readonly<Record<Detail, readonly Choice[]>>;
  /** Saves the change, giving what to tell the person if it wasn't saved. */
  readonly apply: (change: FramesChange) => Promise<string | undefined>;
  readonly children?: ReactNode;
}) {
  const [open, setOpen] = useState<Detail | undefined>(undefined);
  const [value, setValue] = useState(rollsOwn);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | undefined>(undefined);
  const [done, setDone] = useState<string | undefined>(undefined);
  const chosen = details.find((detail) => detail.key === open);

  async function send(event: SubmitEvent, detail: (typeof details)[number]) {
    event.preventDefault();
    setSaving(true);
    const notSaved = await apply(changeOf(detail.key, value));
    setSaving(false);
    setProblem(notSaved);
    if (notSaved === undefined) {
      setDone(
        value === rollsOwn
          ? `${frames(count)} ${count === 1 ? 'uses' : 'use'} the roll’s ${detail.name.toLowerCase()}.`
          : `${detail.name} set on ${frames(count)}.`,
      );
      setOpen(undefined);
    }
  }

  async function setScanMark(toScan: boolean): Promise<void> {
    setDone(undefined);
    setProblem(undefined);
    setSaving(true);
    const notSaved = await apply({ toScan });
    setSaving(false);
    setProblem(notSaved);
    if (notSaved === undefined) {
      const selected = frames(count);
      setDone(
        toScan
          ? `${selected} marked to scan.`
          : `Scan mark removed from ${selected}.`,
      );
    }
  }

  async function setHidden(hidden: boolean): Promise<void> {
    setDone(undefined);
    setProblem(undefined);
    setSaving(true);
    const notSaved = await apply({ hidden });
    setSaving(false);
    setProblem(notSaved);
    if (notSaved === undefined) {
      setDone(`${frames(count)} ${hidden ? 'hidden' : 'unhidden'}.`);
    }
  }

  if (chosen === undefined) {
    return (
      <>
        <MenuButton
          label="Set"
          disabled={count === 0 || saving}
          items={[
            ...details.map((detail) => ({
              label: `${detail.name}…`,
              select: () => {
                setOpen(detail.key);
                setValue(choices[detail.key][0]?.value ?? rollsOwn);
                setDone(undefined);
                setProblem(undefined);
              },
            })),
            {
              label: 'Mark to scan',
              setApart: true,
              select: () => {
                void setScanMark(true);
              },
            },
            {
              label: 'Unmark',
              select: () => {
                void setScanMark(false);
              },
            },
            {
              label: 'Hide',
              setApart: true,
              select: () => {
                void setHidden(true);
              },
            },
            {
              label: 'Unhide',
              select: () => {
                void setHidden(false);
              },
            },
          ]}
        />
        {children}
        {done !== undefined && <p role="status">{done}</p>}
        {problem !== undefined && <p role="alert">{problem}</p>}
      </>
    );
  }

  return (
    <form
      className="assign-to-frames"
      aria-label={`Set ${chosen.name.toLowerCase()}`}
      onSubmit={(event) => void send(event, chosen)}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          // Closes the choice, not Select mode.
          event.stopPropagation();
          setOpen(undefined);
        }
      }}
    >
      <label>
        {chosen.name} for {frames(count)}
        <select
          value={value}
          autoFocus
          onChange={(event) => {
            setValue(event.target.value);
          }}
        >
          {choices[chosen.key].map((choice) => (
            <option key={choice.value} value={choice.value}>
              {choice.label}
            </option>
          ))}
          {chosen.key === 'event' && <option value={noEvent}>No event</option>}
          <option value={rollsOwn}>
            The roll’s {chosen.name.toLowerCase()}
          </option>
        </select>
      </label>
      <button type="submit" className="primary" disabled={saving}>
        Set
      </button>
      <button
        type="button"
        onClick={() => {
          setOpen(undefined);
        }}
      >
        Cancel
      </button>
      {problem !== undefined && <p role="alert">{problem}</p>}
    </form>
  );
}
