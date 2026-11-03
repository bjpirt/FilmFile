import type { Camera, FilmStock, Lens } from '@filmfile/contracts/equipment';
import type { Event } from '@filmfile/contracts/events';
import type { Roll } from '@filmfile/contracts/rolls';
import { useState, type SubmitEvent } from 'react';
import { CameraField } from '../equipment/camera-field.tsx';
import type { EventChoice } from '../events/event-choice.ts';
import { EventField } from '../events/event-field.tsx';
import type { CameraChoice } from '../equipment/camera-choice.ts';
import { choiceOf } from '../forms/pick-or-add.ts';
import type { FilmChoice } from '../equipment/film-choice.ts';
import { FilmStockField } from '../equipment/film-stock-field.tsx';
import type { LensChoice } from '../equipment/lens-choice.ts';
import { LensField } from '../equipment/lens-field.tsx';
import { DateShotFields } from './date-shot-fields.tsx';
import { shotFieldsOf, shotFrom, type ShotFields } from './shot-fields.ts';

/** A roll's details as the panel saves them: all of them, blank ones as null. */
export interface RollDetails {
  readonly name: string | null;
  readonly notes: string | null;
  readonly shot: string;
  /** The camera chosen, which may be a new one. */
  readonly camera: CameraChoice;
  /** The film stock chosen, which may be a new one. */
  readonly film: FilmChoice;
  /** The lens chosen, which may be a new one. */
  readonly lens: LensChoice;
  /** The event chosen, which may be a new one. */
  readonly event: EventChoice;
}

function textOrNull(text: string): string | null {
  return text.trim() === '' ? null : text.trim();
}

/** A roll's name, notes, date shot, camera, lens, film stock and event, to change and save. */
export function EditDetailsPanel({
  roll,
  cameras,
  films,
  lenses,
  events,
  save,
  cancel,
}: {
  readonly roll: Roll;
  readonly cameras: readonly Camera[];
  readonly films: readonly FilmStock[];
  readonly lenses: readonly Lens[];
  readonly events: readonly Event[];
  /** Saves the details, giving what to tell the person if they weren't saved. */
  readonly save: (details: RollDetails) => Promise<string | undefined>;
  readonly cancel: () => void;
}) {
  const [name, setName] = useState(roll.name ?? '');
  const [notes, setNotes] = useState(roll.notes ?? '');
  const [shot, setShot] = useState<ShotFields>(shotFieldsOf(roll.shot));
  const [camera, setCamera] = useState<CameraChoice>(choiceOf(roll.camera));
  const [film, setFilm] = useState<FilmChoice>(choiceOf(roll.film));
  const [lens, setLens] = useState<LensChoice>(choiceOf(roll.lens));
  const [eventChoice, setEventChoice] = useState<EventChoice>(
    choiceOf(roll.event),
  );
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
    const notSaved = await save({
      name: textOrNull(name),
      notes: textOrNull(notes),
      shot: entered.shot,
      camera,
      film,
      lens,
      event: eventChoice,
    });
    // Once saved, the panel closes.
    setSaving(false);
    setProblem(notSaved);
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
        Notes
        <textarea
          value={notes}
          rows={3}
          maxLength={5000}
          onChange={(event) => {
            setNotes(event.target.value);
          }}
        />
      </label>
      <DateShotFields shot={shot} change={setShot} />
      <CameraField cameras={cameras} choice={camera} change={setCamera} />
      <LensField lenses={lenses} choice={lens} change={setLens} />
      <FilmStockField films={films} choice={film} change={setFilm} />
      <EventField
        events={events}
        choice={eventChoice}
        change={setEventChoice}
      />

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
