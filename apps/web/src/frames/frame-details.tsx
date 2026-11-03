import type { ApiClient } from '@filmfile/contracts/client';
import type { Frame, Roll } from '@filmfile/contracts/rolls';
import { useState } from 'react';
import { cameraName, useCameras } from '../equipment/use-cameras.ts';
import { filmStockName, useFilmStocks } from '../equipment/use-film-stocks.ts';
import { lensName, useLenses } from '../equipment/use-lenses.ts';
import { eventName, useEvents } from '../events/use-events.ts';
import { formatShot } from '../rolls/format-shot.ts';
import { shownVersion } from '../rolls/shown-version.ts';
import type { FrameChanges } from './use-save-frame.ts';

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
 * notes), its roll's details, and its versions, any of which can be chosen
 * as the one shown (D15).
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

  const facts = [
    { label: 'Camera', value: cameraName(cameras, roll.camera) },
    { label: 'Lens', value: lensName(lenses, roll.lens) },
    { label: 'Film stock', value: filmStockName(films, roll.film) },
    { label: 'Event', value: eventName(events, roll.event) },
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
        <dl className="roll-facts">
          {facts.map((fact) => (
            <div key={fact.label}>
              <dt>{fact.label}</dt>
              <dd>{fact.value}</dd>
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
