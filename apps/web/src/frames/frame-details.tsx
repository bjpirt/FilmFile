import type { ApiClient } from '@filmfile/contracts/client';
import type { Frame, Roll } from '@filmfile/contracts/rolls';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import {
  cameraLabel,
  cameraName,
  useCameras,
} from '../equipment/use-cameras.ts';
import { filmStockName, useFilmStocks } from '../equipment/use-film-stocks.ts';
import { lensLabel, lensName, useLenses } from '../equipment/use-lenses.ts';
import { eventName, useEvents } from '../events/use-events.ts';
import { DateShotFields } from '../rolls/date-shot-fields.tsx';
import { formatShot } from '../rolls/format-shot.ts';
import { shotFieldsOf, shotFrom } from '../rolls/shot-fields.ts';
import type { FrameChanges } from './use-save-frame.ts';

/** Text saved when its field is left, if it changed: a frame's title or notes. */
function TextField({
  label,
  saved,
  multiline,
  onSave,
}: {
  readonly label: string;
  readonly saved: string | null;
  readonly multiline?: boolean;
  readonly onSave: (text: string | null) => void;
}) {
  const [text, setText] = useState(saved ?? '');
  const props = {
    value: text,
    onChange: (
      change: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => {
      setText(change.target.value);
    },
    onBlur: () => {
      if (text.trim() !== (saved ?? '')) {
        onSave(text.trim() === '' ? null : text);
      }
    },
  };
  return (
    <label className="field">
      {label}
      {multiline === true ? (
        <textarea rows={4} {...props} />
      ) : (
        <input {...props} />
      )}
    </label>
  );
}

/** One of a frame's details, and whether it's the frame's own, which can go back to the roll's. */
interface Fact {
  readonly label: string;
  readonly value: string | undefined;
  /** The layer it came from (design section 6); only the frame's own is marked. */
  readonly from?: 'archive' | 'roll' | 'frame' | undefined;
  /** The change that goes back to the roll's, for one the frame can have of its own. */
  readonly clear?: FrameChanges;
  /** How it's changed in place, for one the frame can have of its own (U58). */
  readonly edit?: Editing;
  /** How a date is changed in place: the frame's own date shot (U59). */
  readonly date?: DateEditing;
}

/** A date changed in its own fields: year, month, day and time. */
interface DateEditing {
  /** The date shown, the frame's own or its roll's, to start from. */
  readonly current: string | null;
  readonly change: (shot: string | null) => FrameChanges;
}

/** A detail changed by choosing from a list: the roll's first, then the archive's. */
interface Editing {
  /** What it's called in "Change the camera". */
  readonly name: string;
  /** The roll's, as the list's first choice says it: "Nikon FE", or "none". */
  readonly rolls: string;
  readonly choices: readonly {
    readonly value: string;
    readonly label: string;
  }[];
  /** The frame's own, or '' when it uses the roll's. */
  readonly current: string;
  /** A choice of none, for a detail that can be left out even when the roll has it (D98): how it's worded, and its save. */
  readonly none?: { readonly label: string; readonly change: FrameChanges };
  /** The save for a choice: a slug, or null for the roll's. */
  readonly change: (value: string | null) => FrameChanges;
}

// Stands for none in the list; no slug begins with #.
const noneChoice = '#none';

/**
 * A detail's value, as it is wherever it came from; the frame's own has a
 * small reset beside it that goes back to the roll's (U57).
 */
function FactValue({
  fact,
  save,
}: {
  readonly fact: Fact;
  readonly save: (changes: FrameChanges) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const label = `Use the roll’s ${fact.label.toLowerCase()}`;
  const { edit, date } = fact;
  if (date !== undefined && editing) {
    return (
      <dd>
        <DateField
          date={date}
          save={(shot) => {
            setEditing(false);
            if (shot !== date.current) {
              void save(date.change(shot));
            }
          }}
          cancel={() => {
            setEditing(false);
          }}
        />
      </dd>
    );
  }
  if (edit !== undefined && editing) {
    return (
      <dd>
        <select
          aria-label={fact.label}
          autoFocus
          value={edit.current}
          onChange={(event) => {
            setEditing(false);
            const chosen = event.target.value;
            void save(
              chosen === noneChoice && edit.none !== undefined
                ? edit.none.change
                : edit.change(chosen === '' ? null : chosen),
            );
          }}
          // Clicking away leaves it as it was.
          onBlur={() => {
            setEditing(false);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              // Closes the list, not the frame view.
              event.stopPropagation();
              setEditing(false);
            }
          }}
        >
          <option value="">The roll’s: {edit.rolls}</option>
          {edit.none !== undefined && (
            <option value={noneChoice}>{edit.none.label}</option>
          )}
          {edit.choices.map((choice) => (
            <option key={choice.value} value={choice.value}>
              {choice.label}
            </option>
          ))}
        </select>
      </dd>
    );
  }
  return (
    <dd>
      {edit === undefined && date === undefined ? (
        fact.value
      ) : (
        <button
          type="button"
          className="editable-value"
          aria-label={`Change the ${edit?.name ?? fact.label.toLowerCase()}`}
          onClick={() => {
            setEditing(true);
          }}
        >
          {fact.value ?? 'Not set'}
        </button>
      )}
      {fact.from === 'frame' && fact.clear !== undefined && (
        <button
          type="button"
          className="reset-detail"
          aria-label={label}
          title={label}
          onClick={() => void save(fact.clear ?? {})}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M4 12a8 8 0 1 0 2.5-5.8" />
            <path d="M4 3v5h5" />
          </svg>
        </button>
      )}
    </dd>
  );
}

/**
 * A frame's own date shot, in year, month, day and time fields: saved on
 * Enter or on leaving them, if the year is given; Esc keeps it as it was.
 */
function DateField({
  date,
  save,
  cancel,
}: {
  readonly date: DateEditing;
  readonly save: (shot: string | null) => void;
  readonly cancel: () => void;
}) {
  const [fields, setFields] = useState(shotFieldsOf(date.current));

  function done() {
    const entered = shotFrom(fields);
    if (entered.valid && entered.shot !== undefined) {
      save(entered.shot);
    } else {
      cancel();
    }
  }

  return (
    <form
      className="date-field"
      onSubmit={(event) => {
        event.preventDefault();
        done();
      }}
      // Leaving the fields, not moving between them, saves.
      onBlur={(event) => {
        if (
          !(event.relatedTarget instanceof Node) ||
          !event.currentTarget.contains(event.relatedTarget)
        ) {
          done();
        }
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          // Keeps the date, and the frame view.
          event.stopPropagation();
          cancel();
        }
      }}
    >
      <DateShotFields shot={fields} change={setFields} legend="Date shot" />
      {/* Enter in the year or time submits the form. */}
      <button type="submit" hidden>
        Save the date shot
      </button>
    </form>
  );
}

/** One to five stars (D39); clicking the rating given clears it. */
function Stars({
  rating,
  onRate,
}: {
  readonly rating: number | null;
  readonly onRate: (rating: number | null) => void;
}) {
  return (
    <div className="stars" role="group" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((stars) => (
        <button
          key={stars}
          type="button"
          className="icon-button star"
          aria-label={stars === 1 ? '1 star' : `${String(stars)} stars`}
          aria-pressed={rating === stars}
          onClick={() => {
            onRate(rating === stars ? null : stars);
          }}
        >
          <span aria-hidden="true">
            {rating !== null && stars <= rating ? '★' : '☆'}
          </span>
        </button>
      ))}
    </div>
  );
}

/**
 * Beside a frame in the frame view: how it's described (title, rating and
 * notes) and its details, those it inherits from the archive and its roll
 * and its own. Its versions are in the frame view's column (U61).
 */
export function FrameDetails({
  api,
  roll,
  frame,
  save,
}: {
  readonly api: ApiClient;
  readonly roll: Roll;
  readonly frame: Frame;
  readonly save: (changes: FrameChanges) => Promise<void>;
}) {
  const cameras = useCameras(api);
  const films = useFilmStocks(api);
  const lenses = useLenses(api);
  const events = useEvents(api);

  // What the frame inherits from the archive and its roll (design section 6).
  const inherited = useQuery({
    queryKey: ['rolls', roll.id, 'frames', frame.id, 'details'],
    queryFn: async () => {
      const { data } = await api.GET(
        '/api/rolls/{rollId}/frames/{frameId}/details',
        { params: { path: { rollId: roll.id, frameId: frame.id } } },
      );
      if (data === undefined) {
        throw new Error("Couldn't load the frame's details.");
      }
      return data;
    },
  }).data;
  const resolvedEvent = inherited?.event?.value;
  const noEvent = frame.event === false;
  const frameEvent = noEvent
    ? 'No event'
    : resolvedEvent === undefined
      ? undefined
      : (eventName(events, resolvedEvent) ?? resolvedEvent);

  const facts: readonly Fact[] = [
    {
      label: 'Author',
      value: inherited?.author?.value,
      from: inherited?.author?.source.layer,
    },
    {
      label: 'Copyright',
      value: inherited?.copyright?.value,
      from: inherited?.copyright?.source.layer,
    },
    {
      label: 'Camera',
      value: cameraName(cameras, inherited?.camera?.value ?? null),
      from: inherited?.camera?.source.layer,
      clear: { camera: null },
      edit: {
        name: 'camera',
        rolls: cameraName(cameras, roll.camera) ?? 'none',
        choices: cameras.map((camera) => ({
          value: camera.slug,
          label: cameraLabel(camera),
        })),
        current: frame.camera ?? '',
        change: (camera: string | null) => ({ camera }),
      },
    },
    {
      label: 'Lens',
      value: lensName(lenses, inherited?.lens?.value ?? null),
      from: inherited?.lens?.source.layer,
      clear: { lens: null },
      edit: {
        name: 'lens',
        rolls: lensName(lenses, roll.lens) ?? 'none',
        choices: lenses.map((lens) => ({
          value: lens.slug,
          label: lensLabel(lens),
        })),
        current: frame.lens ?? '',
        change: (lens: string | null) => ({ lens }),
      },
    },
    {
      label: 'Film stock',
      value: filmStockName(films, inherited?.film?.value ?? null),
      from: inherited?.film?.source.layer,
    },
    {
      label: 'Event',
      value: frameEvent,
      from: noEvent ? 'frame' : inherited?.event?.source.layer,
      clear: { event: null },
      edit: {
        name: 'event',
        rolls: eventName(events, roll.event) ?? 'none',
        choices: events.map((event) => ({
          value: event.slug,
          label: event.name,
        })),
        none: { label: 'No event', change: { event: false as const } },
        current: frame.event === false ? noneChoice : (frame.event ?? ''),
        change: (event: string | null) => ({ event }),
      },
    },
    {
      label: 'Date shot',
      value:
        inherited?.shot === undefined
          ? undefined
          : formatShot(inherited.shot.value),
      from: inherited?.shot?.source.layer,
      clear: { shot: null },
      date: {
        current: inherited?.shot?.value ?? null,
        change: (shot: string | null) => ({ shot }),
      },
    },
    // One that can be changed here is shown even when not set, so it can be.
  ].filter((fact) => fact.value !== undefined || fact.edit !== undefined);

  return (
    <aside
      id="frame-details"
      className="frame-details"
      aria-label="About this frame"
    >
      <TextField
        label="Title"
        saved={frame.title}
        onSave={(title) => void save({ title })}
      />
      <Stars rating={frame.rating} onRate={(rating) => void save({ rating })} />
      <TextField
        label="Notes"
        saved={frame.notes}
        multiline
        onSave={(notes) => void save({ notes })}
      />
      {facts.length > 0 && (
        <dl className="frame-facts">
          {facts.map((fact) => (
            <div key={fact.label}>
              <dt>{fact.label}</dt>
              <FactValue fact={fact} save={save} />
            </div>
          ))}
        </dl>
      )}
    </aside>
  );
}
