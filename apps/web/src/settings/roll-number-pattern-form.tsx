import { useState, type SubmitEvent } from 'react';
import {
  exampleRollNumber,
  parseRollNumberPattern,
} from '../rolls/roll-number-pattern.ts';

/**
 * The pattern new roll numbers are suggested by (D88), saved on its own so
 * the author and copyright aren't touched. It previews an example as it's
 * typed, and says why a pattern can't be saved.
 */
export function RollNumberPatternForm({
  saved,
  save,
}: {
  /** The pattern in the settings. */
  readonly saved: string;
  /** Saves the pattern, giving what to tell the person if it wasn't saved. */
  readonly save: (pattern: string) => Promise<string | undefined>;
}) {
  const [pattern, setPattern] = useState(saved);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | undefined>(undefined);
  const [justSaved, setJustSaved] = useState(false);
  const parsed = parseRollNumberPattern(pattern.trim());

  async function send(event: SubmitEvent) {
    event.preventDefault();
    if (!parsed.ok) {
      setProblem(`The pattern ${parsed.message}.`);
      return;
    }
    setProblem(undefined);
    setSaving(true);
    const notSaved = await save(pattern.trim());
    setSaving(false);
    setProblem(notSaved);
    setJustSaved(notSaved === undefined);
  }

  return (
    <form
      className="roll-details settings-form"
      aria-label="Roll number pattern"
      noValidate
      onSubmit={(event) => void send(event)}
    >
      <h2>Roll number pattern</h2>
      <label>
        Pattern
        <input
          className="numbers"
          value={pattern}
          maxLength={200}
          onChange={(event) => {
            setPattern(event.target.value);
            setJustSaved(false);
          }}
        />
      </label>
      <p className="muted">
        Suggests the number of a new roll, and numbers rolls in “Re-number
        rolls…”. Use <code>{'{n:3}'}</code> once for the number (at least 3
        digits), and any of <code>{'{year}'}</code>, <code>{'{month}'}</code>,{' '}
        <code>{'{day}'}</code> and <code>{'{event}'}</code> from the roll. The
        number starts again for each different date or event used. Changing it
        doesn’t renumber existing rolls.
      </p>
      <p role="status">
        {parsed.ok
          ? `Example: ${exampleRollNumber(parsed.pattern)}`
          : `The pattern ${parsed.message}.`}
      </p>
      {problem !== undefined && <p role="alert">{problem}</p>}
      {justSaved && <p role="status">Saved the roll number pattern.</p>}
      <div className="form-actions">
        <button type="submit" className="primary" disabled={saving}>
          Save pattern
        </button>
      </div>
    </form>
  );
}
