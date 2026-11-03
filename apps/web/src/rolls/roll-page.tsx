import type { ApiClient } from '@filmfile/contracts/client';
import type { Frame, Roll } from '@filmfile/contracts/rolls';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, navigate } from '../routing.tsx';
import { droppedFiles } from './dropped-files.ts';
import { chooseCamera } from '../equipment/choose-camera.ts';
import { cameraName, useCameras } from '../equipment/use-cameras.ts';
import { chooseFilmStock } from '../equipment/choose-film-stock.ts';
import { chooseLens } from '../equipment/choose-lens.ts';
import { lensName, useLenses } from '../equipment/use-lenses.ts';
import { chooseEvent } from '../events/choose-event.ts';
import { eventName, useEvents } from '../events/use-events.ts';
import { filmStockName, useFilmStocks } from '../equipment/use-film-stocks.ts';
import { EditDetailsPanel, type RollDetails } from './edit-details-panel.tsx';
import { formatShot } from './format-shot.ts';
import { frameCount } from './frame-count.ts';
import { FrameNumberEditor, type SaveOutcome } from './frame-number-editor.tsx';
import { inFrameOrder } from './frame-order.ts';
import { renumber } from './renumber.ts';
import { Thumbnail } from './thumbnail.tsx';
import {
  RenumberPanel,
  renumberingOf,
  type RenumberSettings,
} from './renumber-panel.tsx';
import { describeUpload } from './describe-upload.ts';
import { uploadScans, type UploadReport } from './upload-scans.ts';

type Upload =
  | { readonly kind: 'idle' }
  | { readonly kind: 'nothing-to-upload' }
  | {
      readonly kind: 'uploading';
      readonly done: number;
      readonly total: number;
    }
  | { readonly kind: 'finished'; readonly report: UploadReport };

class RollNotFound extends Error {}

/** A frame as a sentence names it: "frame 12", or "the frame with no number". */
function frameName(frame: Frame): string {
  return frame.number === null
    ? 'the frame with no number'
    : `frame ${frame.number}`;
}

/** A frame's number as renumbering would leave it, highlighted if it changes. */
function ProposedNumber({
  current,
  proposed,
}: {
  readonly current: string | null;
  readonly proposed: string | undefined;
}) {
  const shown = proposed ?? current;
  if (shown === null) {
    return (
      <span className="frame-number none" aria-label="No number">
        —
      </span>
    );
  }
  const changes = proposed !== undefined && proposed !== current;
  return (
    <span className="proposed-number">
      <span className={changes ? 'frame-number changed' : 'frame-number'}>
        {shown}
      </span>
      {changes && (
        <del className="previous-number">
          <span className="visually-hidden">previously </span>
          {current ?? '—'}
        </del>
      )}
    </span>
  );
}

/** The roll's name, then a row of its details, then its description: whichever it has. */
function RollAbout({
  roll,
  camera,
  film,
  lens,
  event,
}: {
  readonly roll: Roll;
  readonly camera: string | undefined;
  readonly film: string | undefined;
  readonly lens: string | undefined;
  readonly event: string | undefined;
}) {
  const facts = [
    { label: 'Camera', value: camera },
    { label: 'Lens', value: lens },
    { label: 'Film stock', value: film },
    { label: 'Event', value: event },
    {
      label: 'Shot',
      value: roll.shot === null ? undefined : formatShot(roll.shot),
    },
  ].filter((fact) => fact.value !== undefined);
  if (roll.name === null && facts.length === 0 && roll.description === null) {
    return null;
  }
  return (
    <div className="roll-about">
      {roll.name !== null && <p className="roll-name">{roll.name}</p>}
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
      {roll.description !== null && (
        <p className="roll-description">{roll.description}</p>
      )}
    </div>
  );
}

export function RollPage({
  api,
  rollId,
}: {
  readonly api: ApiClient;
  readonly rollId: string;
}) {
  const queryClient = useQueryClient();
  const cameras = useCameras(api);
  const films = useFilmStocks(api);
  const lenses = useLenses(api);
  const events = useEvents(api);
  const [upload, setUpload] = useState<Upload>({ kind: 'idle' });
  const [order, setOrder] = useState<'frame' | 'scan'>('frame');
  const [changedElsewhere, setChangedElsewhere] = useState(false);
  const [addingScans, setAddingScans] = useState(false);
  // The frame whose delete is being confirmed, if any.
  const [confirmingDelete, setConfirmingDelete] = useState<string | undefined>(
    undefined,
  );
  const [deleteFailed, setDeleteFailed] = useState(false);
  const [confirmingRollDelete, setConfirmingRollDelete] = useState(false);
  const [editingDetails, setEditingDetails] = useState(false);
  const [savingNumbers, setSavingNumbers] = useState(false);
  const [numbersNotSaved, setNumbersNotSaved] = useState(false);
  const [renumbering, setRenumbering] = useState<RenumberSettings | undefined>(
    undefined,
  );

  const roll = useQuery({
    queryKey: ['rolls', rollId],
    queryFn: async () => {
      const { data, response } = await api.GET('/api/rolls/{rollId}', {
        params: { path: { rollId } },
      });
      if (data !== undefined) {
        // The version the roll was read at, sent back as If-Match with a change.
        return { roll: data, etag: response.headers.get('ETag') ?? '' };
      }
      throw response.status === 404
        ? new RollNotFound()
        : new Error("Couldn't load the roll.");
    },
  });

  async function addScans(files: readonly File[]) {
    if (roll.data === undefined) {
      return;
    }
    // Keep the drop zone open, with its progress, once the roll has frames.
    setAddingScans(true);
    if (files.length === 0) {
      setUpload({ kind: 'nothing-to-upload' });
      return;
    }
    const total = files.length;
    setUpload({ kind: 'uploading', done: 0, total });
    const report = await uploadScans(api, roll.data.roll, files, (done) => {
      setUpload({ kind: 'uploading', done, total });
      void queryClient.invalidateQueries({ queryKey: ['rolls', rollId] });
    });
    setUpload({ kind: 'finished', report });
  }

  async function saveNumber(
    frameId: string,
    number: string | null,
  ): Promise<SaveOutcome> {
    if (roll.data === undefined) {
      return 'failed';
    }
    const { response } = await api.PATCH(
      '/api/rolls/{rollId}/frames/{frameId}',
      {
        params: {
          path: { rollId, frameId },
          header: { 'if-match': roll.data.etag },
        },
        body: { number },
      },
    );
    if (response.status === 409) {
      // Saved against the roll as loaded, so nothing changed since is overwritten.
      setChangedElsewhere(true);
      return 'changed-elsewhere';
    }
    if (!response.ok) {
      return 'failed';
    }
    await queryClient.invalidateQueries({ queryKey: ['rolls', rollId] });
    return 'saved';
  }

  /** Deletes a frame, into the archive's deleted folder, if the roll hasn't changed since it loaded. */
  async function deleteFrame(frameId: string) {
    if (roll.data === undefined) {
      return;
    }
    setDeleteFailed(false);
    const { response } = await api.DELETE(
      '/api/rolls/{rollId}/frames/{frameId}',
      {
        params: {
          path: { rollId, frameId },
          header: { 'if-match': roll.data.etag },
        },
      },
    );
    setConfirmingDelete(undefined);
    if (response.status === 409) {
      setChangedElsewhere(true);
      return;
    }
    if (!response.ok) {
      setDeleteFailed(true);
      return;
    }
    // The rolls list counts frames too.
    await queryClient.invalidateQueries({ queryKey: ['rolls'] });
  }

  /** Deletes the roll, frames and all, into the archive's deleted folder (D38), then opens the rolls page. */
  async function deleteRoll() {
    if (roll.data === undefined) {
      return;
    }
    setDeleteFailed(false);
    const { response } = await api.DELETE('/api/rolls/{rollId}', {
      params: { path: { rollId }, header: { 'if-match': roll.data.etag } },
    });
    setConfirmingRollDelete(false);
    if (response.status === 409) {
      setChangedElsewhere(true);
      return;
    }
    if (!response.ok) {
      setDeleteFailed(true);
      return;
    }
    // The roll is gone, so it's dropped rather than reloaded, which would
    // only find it missing; the rolls list is reloaded when it next shows.
    queryClient.removeQueries({ queryKey: ['rolls', rollId] });
    await queryClient.invalidateQueries({ queryKey: ['rolls'], exact: true });
    navigate('/');
  }

  /** Saves every frame's proposed number in one update, closing the panel if it's saved. */
  async function saveRenumbering(
    frames: readonly Frame[],
    proposed: readonly string[],
  ) {
    if (roll.data === undefined) {
      return;
    }
    setSavingNumbers(true);
    setNumbersNotSaved(false);
    const { response } = await api.PATCH('/api/rolls/{rollId}/frames', {
      params: {
        path: { rollId },
        header: { 'if-match': roll.data.etag },
      },
      body: {
        numbers: frames.map((frame, i) => ({
          frameId: frame.id,
          number: proposed[i] ?? null,
        })),
      },
    });
    setSavingNumbers(false);
    if (response.status === 409) {
      setChangedElsewhere(true);
      return;
    }
    if (!response.ok) {
      setNumbersNotSaved(true);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ['rolls', rollId] });
    setRenumbering(undefined);
  }

  /** Saves the roll's details, giving what to say if they weren't saved. */
  async function saveDetails(
    details: RollDetails,
  ): Promise<string | undefined> {
    if (roll.data === undefined) {
      return undefined;
    }
    const camera = await chooseCamera(api, details.camera);
    if (!camera.ok) {
      return camera.problem;
    }
    await queryClient.invalidateQueries({ queryKey: ['cameras'] });
    const film = await chooseFilmStock(api, details.film);
    if (!film.ok) {
      return film.problem;
    }
    await queryClient.invalidateQueries({ queryKey: ['films'] });
    const lens = await chooseLens(api, details.lens);
    if (!lens.ok) {
      return lens.problem;
    }
    await queryClient.invalidateQueries({ queryKey: ['lenses'] });
    const event = await chooseEvent(api, details.event);
    if (!event.ok) {
      return event.problem;
    }
    await queryClient.invalidateQueries({ queryKey: ['events'] });
    const { response } = await api.PATCH('/api/rolls/{rollId}', {
      params: {
        path: { rollId },
        header: { 'if-match': roll.data.etag },
      },
      body: {
        ...details,
        camera: camera.slug,
        film: film.slug,
        lens: lens.slug,
        event: event.slug,
      },
    });
    if (response.status === 409) {
      // Said by the banner, with its Reload.
      setChangedElsewhere(true);
      return undefined;
    }
    // The panel checks the year and the equipment exists, so the date is all
    // the service can refuse.
    if (response.status === 422) {
      return "That date doesn't exist. Check the day and month.";
    }
    if (!response.ok) {
      return "Couldn't save the details. Is the service running?";
    }
    // The rolls list shows the details too.
    await queryClient.invalidateQueries({ queryKey: ['rolls'] });
    setEditingDetails(false);
    return undefined;
  }

  async function reload() {
    await queryClient.invalidateQueries({ queryKey: ['rolls', rollId] });
    setChangedElsewhere(false);
  }

  /** Where renumbering starts: the first scan's number if it's a whole number. */
  function startRenumbering(frames: readonly Frame[]) {
    const first = frames[0]?.number ?? '';
    setRenumbering({
      from: 'first',
      number: /^-?\d+$/.test(first) ? first : '1',
      direction: 'up',
    });
  }

  if (roll.isPending) {
    return <p>Loading the roll…</p>;
  }
  if (roll.isError) {
    return (
      <p>
        {roll.error instanceof RollNotFound
          ? 'There is no such roll.'
          : "Couldn't load the roll. Is the service running?"}{' '}
        <Link to="/">All rolls</Link>
      </p>
    );
  }

  const frames = roll.data.roll.frames;
  // While renumbering, frames are shown in scan order, which is the order the numbers count along.
  const shown =
    renumbering === undefined && order === 'frame'
      ? inFrameOrder(frames)
      : frames;
  const settings = renumbering && renumberingOf(renumbering);
  const proposed =
    settings === undefined ? undefined : renumber(frames.length, settings);
  const changing = proposed?.filter(
    (number, i) => number !== frames[i]?.number,
  ).length;
  // An empty roll is waiting for its scans, so the drop zone is open from the start.
  const dropZoneOpen = addingScans || frames.length === 0;

  return (
    <section>
      <div className="page-heading">
        <div className="roll-title">
          <Link to="/">All rolls</Link>
          <span className="muted" aria-hidden="true">
            /
          </span>
          <h1>
            <span className="visually-hidden">Roll </span>
            <span className="roll-number">{roll.data.roll.roll}</span>
          </h1>
          <span className="muted">{frameCount(frames.length)}</span>
        </div>
        {confirmingRollDelete ? (
          // In place of the buttons, so nothing below moves.
          <div
            role="alertdialog"
            aria-label={`Delete roll ${roll.data.roll.roll}`}
            className="page-actions confirm-roll-delete"
          >
            <p>
              {frames.length === 0
                ? 'Delete this roll?'
                : `Delete this roll and its ${frameCount(frames.length)}?`}
            </p>
            <button
              type="button"
              className="danger"
              onClick={() => void deleteRoll()}
            >
              Delete roll
            </button>
            <button
              type="button"
              autoFocus
              onClick={() => {
                setConfirmingRollDelete(false);
              }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="page-actions">
            <button
              type="button"
              aria-expanded={editingDetails}
              aria-controls="edit-details"
              onClick={() => {
                setEditingDetails(!editingDetails);
              }}
            >
              Edit details
            </button>
            {frames.length > 0 && (
              <button
                type="button"
                aria-expanded={dropZoneOpen}
                aria-controls="drop-zone"
                onClick={() => {
                  setAddingScans(!addingScans);
                }}
              >
                Add scans
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setConfirmingRollDelete(true);
              }}
            >
              Delete roll…
            </button>
          </div>
        )}
      </div>

      {editingDetails && (
        <EditDetailsPanel
          roll={roll.data.roll}
          cameras={cameras}
          films={films}
          lenses={lenses}
          events={events}
          save={saveDetails}
          cancel={() => {
            setEditingDetails(false);
          }}
        />
      )}

      {!editingDetails && (
        <RollAbout
          roll={roll.data.roll}
          camera={cameraName(cameras, roll.data.roll.camera)}
          film={filmStockName(films, roll.data.roll.film)}
          lens={lensName(lenses, roll.data.roll.lens)}
          event={eventName(events, roll.data.roll.event)}
        />
      )}

      {deleteFailed && (
        <p role="alert">Couldn't delete that. Is the service running?</p>
      )}

      {changedElsewhere && (
        <p role="alert" className="changed-elsewhere">
          This roll changed since you opened it.{' '}
          <button type="button" onClick={() => void reload()}>
            Reload
          </button>
        </p>
      )}

      {dropZoneOpen && (
        <div
          id="drop-zone"
          className="drop-zone"
          onDragOver={(event) => {
            event.preventDefault();
          }}
          onDrop={(event) => {
            event.preventDefault();
            void droppedFiles(event.dataTransfer).then(addScans);
          }}
        >
          <p>Drop individual scans here</p>
          <label>
            Choose scans
            <input
              type="file"
              accept="image/jpeg"
              multiple
              disabled={upload.kind === 'uploading'}
              onChange={(event) => {
                void addScans(Array.from(event.target.files ?? []));
                event.target.value = '';
              }}
            />
          </label>
          {upload.kind === 'uploading' && (
            <p role="status">
              Uploading {Math.min(upload.done + 1, upload.total)} of{' '}
              {upload.total}…
            </p>
          )}
          {upload.kind === 'nothing-to-upload' && (
            <p role="status">
              No JPEG scans found. In a folder, only scans directly inside it
              are picked up, not those in folders within it.
            </p>
          )}
          {upload.kind === 'finished' && (
            <p role="status">{describeUpload(upload.report)}</p>
          )}
        </div>
      )}

      {frames.length === 0 ? (
        <p>No frames yet.</p>
      ) : (
        <>
          {renumbering === undefined ? (
            <div className="sheet-controls">
              <fieldset className="order">
                <legend>Show frames in</legend>
                <label>
                  <input
                    type="radio"
                    name="order"
                    checked={order === 'frame'}
                    onChange={() => {
                      setOrder('frame');
                    }}
                  />
                  Frame order
                </label>
                <label>
                  <input
                    type="radio"
                    name="order"
                    checked={order === 'scan'}
                    onChange={() => {
                      setOrder('scan');
                    }}
                  />
                  Scan order
                </label>
              </fieldset>
              <button
                type="button"
                onClick={() => {
                  startRenumbering(frames);
                }}
              >
                Renumber…
              </button>
            </div>
          ) : (
            <RenumberPanel
              settings={renumbering}
              changing={changing}
              change={setRenumbering}
              saving={savingNumbers}
              notSaved={numbersNotSaved}
              save={() => {
                if (proposed !== undefined) {
                  void saveRenumbering(frames, proposed);
                }
              }}
              cancel={() => {
                setNumbersNotSaved(false);
                setRenumbering(undefined);
              }}
            />
          )}
          <ol className="contact-sheet" aria-label="Contact sheet">
            {shown.map((frame, i) => (
              <li key={frame.id}>
                <div className="frame-picture">
                  <Link
                    to={`/rolls/${rollId}/frames/${frame.id}`}
                    aria-label={`Open ${frameName(frame)}`}
                  >
                    <Thumbnail rollId={rollId} frame={frame} />
                  </Link>
                  {confirmingDelete === frame.id && (
                    // Over the thumbnail, the same size, so nothing else moves.
                    <div
                      role="alertdialog"
                      aria-label={`Delete ${frameName(frame)}`}
                      className="confirm-delete"
                    >
                      <p className="confirm-question">Delete this frame?</p>
                      <div className="confirm-actions">
                        <button
                          type="button"
                          className="danger"
                          onClick={() => void deleteFrame(frame.id)}
                        >
                          Delete
                        </button>
                        <button
                          type="button"
                          autoFocus
                          onClick={() => {
                            setConfirmingDelete(undefined);
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                  {renumbering === undefined &&
                    confirmingDelete !== frame.id && (
                      <button
                        type="button"
                        className="frame-delete"
                        aria-label={`Delete ${frameName(frame)}`}
                        title={`Delete ${frameName(frame)}`}
                        onClick={() => {
                          setConfirmingDelete(frame.id);
                        }}
                      >
                        {/* A bin, so the button adds no text to the frame's caption. */}
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
                        </svg>
                      </button>
                    )}
                </div>
                {renumbering === undefined ? (
                  <FrameNumberEditor
                    number={frame.number}
                    save={(number) => saveNumber(frame.id, number)}
                  />
                ) : (
                  <ProposedNumber
                    current={frame.number}
                    proposed={proposed?.[i]}
                  />
                )}
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}
