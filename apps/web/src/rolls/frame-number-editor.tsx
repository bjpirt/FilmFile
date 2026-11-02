import { useState } from 'react';

/** How a save went. The page explains a roll changed elsewhere. */
export type SaveOutcome = 'saved' | 'changed-elsewhere' | 'failed';

/**
 * A frame's number, which turns into a text box when clicked: Enter saves,
 * Esc or leaving the box cancels. Emptying it clears the number.
 */
export function FrameNumberEditor({
  number,
  save,
}: {
  readonly number: string | null;
  /** Saves the new number, or null to clear it. */
  readonly save: (number: string | null) => Promise<SaveOutcome>;
}) {
  const [draft, setDraft] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  // After a refused save, the box stays open with what was typed, to try again.
  const [refused, setRefused] = useState<SaveOutcome | undefined>(undefined);

  function stopEditing() {
    setDraft(undefined);
    setRefused(undefined);
  }

  async function submit(value: string) {
    setSaving(true);
    const trimmed = value.trim();
    const outcome = await save(trimmed === '' ? null : trimmed);
    setSaving(false);
    if (outcome === 'saved') {
      stopEditing();
    } else {
      setRefused(outcome);
    }
  }

  if (draft === undefined) {
    return (
      <button
        type="button"
        className="frame-number-button"
        aria-label={
          number === null
            ? 'Set a frame number'
            : `Change frame number ${number}`
        }
        onClick={() => {
          setDraft(number ?? '');
        }}
      >
        {number === null ? (
          <span className="frame-number none" aria-label="No number">
            —
          </span>
        ) : (
          <span className="frame-number">{number}</span>
        )}
      </button>
    );
  }

  return (
    <span className="frame-number-editor">
      <input
        aria-label="Frame number"
        className="frame-number"
        value={draft}
        maxLength={9}
        size={9}
        disabled={saving}
        autoFocus
        onChange={(event) => {
          setDraft(event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            void submit(draft);
          } else if (event.key === 'Escape') {
            stopEditing();
          }
        }}
        onBlur={() => {
          if (!saving && refused === undefined) {
            stopEditing();
          }
        }}
      />
      {refused === 'failed' && (
        <span role="alert">Couldn't save the number.</span>
      )}
    </span>
  );
}
