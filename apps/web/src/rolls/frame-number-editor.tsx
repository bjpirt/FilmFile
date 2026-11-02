import { useState } from 'react';

/**
 * A frame's number, which turns into a text box when clicked: Enter saves,
 * Esc or leaving the box cancels. Emptying it clears the number.
 */
export function FrameNumberEditor({
  number,
  save,
}: {
  readonly number: string | null;
  /** Saves the new number, or null to clear it; resolves to whether it was saved. */
  readonly save: (number: string | null) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  function stopEditing() {
    setDraft(undefined);
    setFailed(false);
  }

  async function submit(value: string) {
    setSaving(true);
    const trimmed = value.trim();
    const saved = await save(trimmed === '' ? null : trimmed);
    setSaving(false);
    if (saved) {
      stopEditing();
    } else {
      setFailed(true);
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
          if (!saving && !failed) {
            stopEditing();
          }
        }}
      />
      {failed && <span role="alert">Couldn't save the number.</span>}
    </span>
  );
}
