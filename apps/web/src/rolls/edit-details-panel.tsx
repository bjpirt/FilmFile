import type { Roll } from '@filmfile/contracts/rolls';
import { useState, type SubmitEvent } from 'react';
import { DateShotFields } from './date-shot-fields.tsx';
import { shotFieldsOf, shotFrom, type ShotFields } from './shot-fields.ts';

/** A roll's details as the panel saves them: all of them, blank ones as null. */
export interface RollDetails {
  readonly name: string | null;
  readonly description: string | null;
  readonly shot: string;
}

/** What became of saving the details; a roll changed elsewhere is said by the page. */
export type DetailsOutcome =
  'saved' | 'changed-elsewhere' | 'not-a-date' | 'failed';

function textOrNull(text: string): string | null {
  return text.trim() === '' ? null : text.trim();
}

/** A roll's name, description and date shot, to change and save. */
export function EditDetailsPanel({
  roll,
  save,
  cancel,
}: {
  readonly roll: Roll;
  readonly save: (details: RollDetails) => Promise<DetailsOutcome>;
  readonly cancel: () => void;
}) {
  const [name, setName] = useState(roll.name ?? '');
  const [description, setDescription] = useState(roll.description ?? '');
  const [shot, setShot] = useState<ShotFields>(shotFieldsOf(roll.shot));
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | undefined>(undefined);

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    const entered = shotFrom(shot);
    // A roll needs at least the year it was shot, as when it was created.
    if (!entered.valid || entered.shot === undefined) {
      setProblem('Enter the year as four digits, like 2026.');
      return;
    }
    setProblem(undefined);
    setSaving(true);
    const outcome = await save({
      name: textOrNull(name),
      description: textOrNull(description),
      shot: entered.shot,
    });
    // Once saved, the panel closes.
    if (outcome === 'saved') {
      return;
    }
    setSaving(false);
    if (outcome === 'not-a-date') {
      setProblem("That date doesn't exist. Check the day and month.");
    }
    if (outcome === 'failed') {
      setProblem("Couldn't save the details. Is the service running?");
    }
  }

  return (
    // noValidate: the panel's own messages explain a missing field.
    <form
      id="edit-details"
      className="roll-details edit-details"
      aria-label="Roll details"
      noValidate
      onSubmit={(event) => void submit(event)}
    >
      <label>
        Name
        <input
          value={name}
          maxLength={100}
          autoFocus
          onChange={(event) => {
            setName(event.target.value);
          }}
        />
      </label>
      <label>
        Description
        <textarea
          value={description}
          rows={3}
          maxLength={5000}
          onChange={(event) => {
            setDescription(event.target.value);
          }}
        />
      </label>
      <DateShotFields shot={shot} change={setShot} />

      {problem !== undefined && <p role="alert">{problem}</p>}

      <div className="form-actions">
        <button type="submit" className="primary" disabled={saving}>
          Save details
        </button>
        <button type="button" onClick={cancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
