import type { ApiClient } from '@filmfile/contracts/client';
import type { Frame } from '@filmfile/contracts/rolls';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from '../routing.tsx';
import { droppedFiles } from './dropped-files.ts';
import { FrameNumberEditor, type SaveOutcome } from './frame-number-editor.tsx';
import { inFrameOrder } from './frame-order.ts';
import { renumber } from './renumber.ts';
import {
  RenumberPanel,
  renumberingOf,
  type RenumberSettings,
} from './renumber-panel.tsx';
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

function describe(report: UploadReport): string {
  const parts = [
    `Uploaded ${String(report.uploaded)} ${report.uploaded === 1 ? 'scan' : 'scans'}.`,
  ];
  if (report.alreadyInRoll > 0) {
    parts.push(
      `${String(report.alreadyInRoll)} ${report.alreadyInRoll === 1 ? 'was' : 'were'} already in the roll.`,
    );
  }
  if (report.failed.length > 0) {
    const failures = report.failed.map((f) => `${f.file} (${f.reason})`);
    parts.push(`Not uploaded: ${failures.join(', ')}.`);
  }
  return parts.join(' ');
}

function Thumbnail({
  rollId,
  frame,
}: {
  readonly rollId: string;
  readonly frame: Frame;
}) {
  // The newest version, until frames have a default version.
  const version = frame.versions.at(-1);
  if (version === undefined) {
    return <div className="no-scan">No scan</div>;
  }
  return (
    <img
      src={`/api/rolls/${rollId}/frames/${frame.id}/versions/${version.id}/thumbnail?size=small`}
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
    <span className={changes ? 'frame-number changed' : 'frame-number'}>
      {shown}
    </span>
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
  const [upload, setUpload] = useState<Upload>({ kind: 'idle' });
  const [order, setOrder] = useState<'frame' | 'scan'>('frame');
  const [changedElsewhere, setChangedElsewhere] = useState(false);
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

  return (
    <section>
      <p>
        <Link to="/">All rolls</Link>
      </p>
      <h2>Roll {roll.data.roll.roll}</h2>

      {changedElsewhere && (
        <p role="alert" className="changed-elsewhere">
          This roll changed since you opened it.{' '}
          <button type="button" onClick={() => void reload()}>
            Reload
          </button>
        </p>
      )}

      <div
        className="drop-zone"
        onDragOver={(event) => {
          event.preventDefault();
        }}
        onDrop={(event) => {
          event.preventDefault();
          void droppedFiles(event.dataTransfer).then(addScans);
        }}
      >
        <p>Drop lab scans or a folder of them here, or choose them:</p>
        <label>
          Choose lab scans
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
            No JPEG scans found. In a folder, only scans directly inside it are
            picked up, not those in folders within it.
          </p>
        )}
        {upload.kind === 'finished' && (
          <p role="status">{describe(upload.report)}</p>
        )}
      </div>

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
