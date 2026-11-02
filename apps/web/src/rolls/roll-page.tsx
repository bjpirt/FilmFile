import type { ApiClient } from '@filmfile/contracts/client';
import type { Frame } from '@filmfile/contracts/rolls';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from '../routing.tsx';
import { droppedFiles } from './dropped-files.ts';
import { FrameNumberEditor } from './frame-number-editor.tsx';
import { inFrameOrder } from './frame-order.ts';
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
  ): Promise<boolean> {
    if (roll.data === undefined) {
      return false;
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
    if (!response.ok) {
      return false;
    }
    await queryClient.invalidateQueries({ queryKey: ['rolls', rollId] });
    return true;
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

  return (
    <section>
      <p>
        <Link to="/">All rolls</Link>
      </p>
      <h2>Roll {roll.data.roll.roll}</h2>

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

      {roll.data.roll.frames.length === 0 ? (
        <p>No frames yet.</p>
      ) : (
        <>
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
          <ol className="contact-sheet">
            {(order === 'frame'
              ? inFrameOrder(roll.data.roll.frames)
              : roll.data.roll.frames
            ).map((frame) => (
              <li key={frame.id}>
                <Thumbnail rollId={rollId} frame={frame} />
                <FrameNumberEditor
                  number={frame.number}
                  save={(number) => saveNumber(frame.id, number)}
                />
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}
