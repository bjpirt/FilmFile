import { useState, type SubmitEvent } from 'react';
import { RequiredMarker } from '../forms/required-marker.tsx';
import { DateShotFields } from '../rolls/date-shot-fields.tsx';
import {
  shotFieldsOf,
  shotFrom,
  type ShotFields,
} from '../rolls/shot-fields.ts';

/** An event's details as the form saves them. */
export interface EventDetails {
  readonly name: string;
  /** e.g. `2026-09`, or null for no date. */
  readonly date: string | null;
}

/** An event's name and optional date, to add or change. */
export function EventForm({
  label,
  initial,
  submit,
  save,
  cancel,
}: {
  /** The form's name, for screen readers, e.g. "New event". */
  readonly label: string;
  readonly initial: EventDetails;
  /** The submit button's text. */
  readonly submit: string;
  /** Saves the details, giving what to tell the person if they weren't saved. */
  readonly save: (details: EventDetails) => Promise<string | undefined>;
  readonly cancel: () => void;
}) {
  const [name, setName] = useState(initial.name);
  const [date, setDate] = useState<ShotFields>(shotFieldsOf(initial.date));
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | undefined>(undefined);

  async function send(event: SubmitEvent) {
    event.preventDefault();
    if (name.trim() === '') {
      setProblem('Enter a name for the event, like Iceland 2026.');
      return;
    }
    const entered = shotFrom(date);
    if (!entered.valid) {
      setProblem('Enter the year as four digits, like 2026.');
      return;
    }
    setProblem(undefined);
    setSaving(true);
    const notSaved = await save({
      name: name.trim(),
      date: entered.shot ?? null,
    });
    // Once saved, the form closes.
    setSaving(false);
    setProblem(notSaved);
  }

  return (
    // noValidate: the form's own messages explain a missing field.
    <form
      className="roll-details event-form"
      aria-label={label}
      noValidate
      onSubmit={(event) => void send(event)}
    >
      <label>
        <span>
          Name <RequiredMarker />
        </span>
        <input
          value={name}
          placeholder="Iceland 2026"
          maxLength={100}
          autoFocus
          onChange={(event) => {
            setName(event.target.value);
          }}
        />
      </label>
      <DateShotFields
        shot={date}
        change={setDate}
        legend="Date"
        yearRequired={false}
        withTime={false}
      />
      {problem !== undefined && <p role="alert">{problem}</p>}
      <div className="form-actions">
        <button type="submit" className="primary" disabled={saving}>
          {submit}
        </button>
        <button type="button" onClick={cancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
