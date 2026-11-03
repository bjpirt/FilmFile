import type { ApiClient } from '@filmfile/contracts/client';
import type { Frame, Roll } from '@filmfile/contracts/rolls';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from '../routing.tsx';
import { droppedFiles } from './dropped-files.ts';
import { chooseCamera } from '../equipment/choose-camera.ts';
import { cameraName, useCameras } from '../equipment/use-cameras.ts';
import { EditDetailsPanel, type RollDetails } from './edit-details-panel.tsx';
import { formatShot } from './format-shot.ts';
import { frameCount } from './frame-count.ts';
import { FrameNumberEditor, type SaveOutcome } from './frame-number-editor.tsx';
import { inFrameOrder } from './frame-order.ts';
import { renumber } from './renumber.ts';
import { thumbnailUrl } from './thumbnail-url.ts';
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

function Thumbnail({
  rollId,
  frame,
}: {
  readonly rollId: string;
  readonly frame: Frame;
}) {
  const src = thumbnailUrl(rollId, frame);
  const version = frame.versions.at(-1);
  if (src === undefined || version === undefined) {
    return <div className="no-scan">No scan</div>;
  }
  return (
    <img
      src={src}
      alt={version.file.split('/').at(-1)}
      width={version.width}
      height={version.height}
    />
  );
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
}: {
  readonly roll: Roll;
  readonly camera: string | undefined;
}) {
  if (
    roll.name === null &&
    camera === undefined &&
    roll.shot === null &&
    roll.description === null
  ) {
    return null;
  }
  return (
    <div className="roll-about">
      {roll.name !== null && <p className="roll-name">{roll.name}</p>}
      {(camera !== undefined || roll.shot !== null) && (
        <dl className="roll-facts">
          {camera !== undefined && (
            <div>
              <dt>Camera</dt>
              <dd>{camera}</dd>
            </div>
          )}
          {roll.shot !== null && (
            <div>
              <dt>Shot</dt>
              <dd>{formatShot(roll.shot)}</dd>
            </div>
          )}
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
  const [upload, setUpload] = useState<Upload>({ kind: 'idle' });
  const [order, setOrder] = useState<'frame' | 'scan'>('frame');
  const [changedElsewhere, setChangedElsewhere] = useState(false);
  const [addingScans, setAddingScans] = useState(false);
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
    const camera = await chooseCamera(api, cameras, details.camera);
    if (!camera.ok) {
      return camera.problem;
    }
    await queryClient.invalidateQueries({ queryKey: ['cameras'] });
    const { response } = await api.PATCH('/api/rolls/{rollId}', {
      params: {
        path: { rollId },
        header: { 'if-match': roll.data.etag },
      },
      body: { ...details, camera: camera.slug },
    });
    if (response.status === 409) {
      // Said by the banner, with its Reload.
      setChangedElsewhere(true);
      return undefined;
    }
    // The panel checks the year and the camera exists, so the date is all
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
        </div>
      </div>

      {editingDetails && (
        <EditDetailsPanel
          roll={roll.data.roll}
          cameras={cameras}
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
        />
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
                <Thumbnail rollId={rollId} frame={frame} />
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
