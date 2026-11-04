import type { ApiClient } from '@filmfile/contracts/client';
import type { Frame, Roll } from '@filmfile/contracts/rolls';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { cameraName, useCameras } from '../equipment/use-cameras.ts';
import { filmStockName, useFilmStocks } from '../equipment/use-film-stocks.ts';
import { lensName, useLenses } from '../equipment/use-lenses.ts';
import { eventName, useEvents } from '../events/use-events.ts';
import { formatShot } from '../rolls/format-shot.ts';
import { shownVersion } from '../rolls/shown-version.ts';
import type { FrameChanges, RollChange } from './use-save-frame.ts';

const months = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/** A file's size as people read it: "3 bytes", "640 KB", "2.4 MB". */
export function formatBytes(bytes: number): string {
  if (bytes < 1000) {
    return `${String(bytes)} bytes`;
  }
  if (bytes < 1_000_000) {
    return `${String(Math.round(bytes / 1000))} KB`;
  }
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}

/** When a version was added, as a day: "2 Nov 2026". */
function formatAdded(added: string): string {
  const date = new Date(added);
  return `${String(date.getUTCDate())} ${months[date.getUTCMonth()] ?? ''} ${String(date.getUTCFullYear())}`;
}

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

/** One of a frame's details, where it came from, and what can be done with it if it's the frame's own. */
interface Fact {
  readonly label: string;
  readonly value: string | undefined;
  /** The layer it came from (design section 6), or undefined for one of the roll's own, like when it was shot. */
  readonly from?: 'archive' | 'roll' | 'frame' | undefined;
  /** The change that goes back to the roll's, for one the frame can have of its own. */
  readonly clear?: FrameChanges;
  /** The change that sets it on the roll instead. */
  readonly onRoll?: RollChange;
}

const sources = {
  archive: 'from the archive',
  roll: 'from the roll',
  frame: 'this frame’s own',
} as const;

/**
 * A detail's value: in grey with where it came from when inherited, or as
 * the frame's own, which can go back to the roll's or be set on the roll for
 * every frame (U39).
 */
function FactValue({
  fact,
  save,
  setOnRoll,
}: {
  readonly fact: Fact;
  readonly save: (changes: FrameChanges) => Promise<void>;
  readonly setOnRoll: (change: RollChange) => Promise<void>;
}) {
  const own = fact.from === 'frame';
  const name = fact.label.toLowerCase();
  return (
    <dd
      className={
        own ? 'own' : fact.from === undefined ? undefined : 'inherited'
      }
    >
      <span className="fact-value">{fact.value}</span>
      {fact.from !== undefined && (
        <span className="fact-source">{sources[fact.from]}</span>
      )}
      {own && (
        <span className="fact-actions">
          {fact.clear !== undefined && (
            <button
              type="button"
              aria-label={`Use the roll’s ${name}`}
              onClick={() => void save(fact.clear ?? {})}
            >
              Use the roll’s
            </button>
          )}
          {fact.onRoll !== undefined && (
            <button
              type="button"
              aria-label={`Set the ${name} on the roll instead`}
              onClick={() => {
                if (fact.onRoll !== undefined) {
                  void setOnRoll(fact.onRoll);
                }
              }}
            >
              Set on roll instead
            </button>
          )}
        </span>
      )}
    </dd>
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
 * notes), the details it inherits from the archive and its roll, and its
 * versions, any of which can be chosen as the one shown (D15).
 */
export function FrameDetails({
  api,
  roll,
  frame,
  save,
  setOnRoll,
}: {
  readonly api: ApiClient;
  readonly roll: Roll;
  readonly frame: Frame;
  readonly save: (changes: FrameChanges) => Promise<void>;
  readonly setOnRoll: (change: RollChange) => Promise<void>;
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
  const frameEvents = (inherited?.events?.value ?? []).map(
    (slug) => eventName(events, slug) ?? slug,
  );

  const ownEvents = inherited?.events?.value;
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
      ...(inherited?.camera === undefined
        ? {}
        : {
            clear: { camera: null },
            onRoll: { camera: inherited.camera.value },
          }),
    },
    {
      label: 'Lens',
      value: lensName(lenses, inherited?.lens?.value ?? null),
      from: inherited?.lens?.source.layer,
      ...(inherited?.lens === undefined
        ? {}
        : { clear: { lens: null }, onRoll: { lens: inherited.lens.value } }),
    },
    {
      label: 'Film stock',
      value: filmStockName(films, inherited?.film?.value ?? null),
      from: inherited?.film?.source.layer,
    },
    {
      label: frameEvents.length > 1 ? 'Events' : 'Event',
      value: frameEvents.length === 0 ? undefined : frameEvents.join(', '),
      from: inherited?.events?.source.layer,
      clear: { events: null },
      // A roll is in one event of its own, so only one can move onto it.
      ...(ownEvents?.length === 1 && ownEvents[0] !== undefined
        ? { onRoll: { event: ownEvents[0] } }
        : {}),
    },
    {
      label: 'Shot',
      value: roll.shot === null ? undefined : formatShot(roll.shot),
    },
  ].filter((fact) => fact.value !== undefined);
  const shown = shownVersion(frame);

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
              <FactValue fact={fact} save={save} setOnRoll={setOnRoll} />
            </div>
          ))}
        </dl>
      )}
      <h2>Versions</h2>
      {frame.versions.length === 0 ? (
        <p className="muted">No scans yet.</p>
      ) : (
        <ol className="versions" aria-label="Versions">
          {frame.versions.map((version) => (
            <li key={version.id}>
              <span className="version-file">
                {version.file.split('/').at(-1)}
              </span>
              <span className="muted">
                {formatBytes(version.bytes)} · {version.width} ×{' '}
                {version.height} · {formatAdded(version.added)}
              </span>
              {version.id === shown?.id ? (
                <span className="version-shown">Shown</span>
              ) : (
                <button
                  type="button"
                  onClick={() => void save({ defaultVersion: version.id })}
                >
                  Set as default
                </button>
              )}
            </li>
          ))}
        </ol>
      )}
    </aside>
  );
}
