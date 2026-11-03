import type { ApiClient } from '@filmfile/contracts/client';
import type { Frame, Roll } from '@filmfile/contracts/rolls';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { cameraName, useCameras } from '../equipment/use-cameras.ts';
import { filmStockName, useFilmStocks } from '../equipment/use-film-stocks.ts';
import { lensName, useLenses } from '../equipment/use-lenses.ts';
import { eventName, useEvents } from '../events/use-events.ts';
import { formatShot } from '../rolls/format-shot.ts';
import { shownVersion } from '../rolls/shown-version.ts';

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

/**
 * Beside a frame in the frame view: its details (for now, its roll's) and its
 * versions, any of which can be chosen as the one shown (D15).
 */
export function FrameDetails({
  api,
  roll,
  frame,
}: {
  readonly api: ApiClient;
  readonly roll: Roll;
  readonly frame: Frame;
}) {
  const queryClient = useQueryClient();
  const cameras = useCameras(api);
  const films = useFilmStocks(api);
  const lenses = useLenses(api);
  const events = useEvents(api);
  const [problem, setProblem] = useState<string | undefined>(undefined);
  // The roll as read, for its version: a change is sent against it.
  const read = useQuery({
    queryKey: ['rolls', roll.id],
    queryFn: async () => {
      const { data, response } = await api.GET('/api/rolls/{rollId}', {
        params: { path: { rollId: roll.id } },
      });
      if (data === undefined) {
        throw new Error("Couldn't load the roll.");
      }
      return { roll: data, etag: response.headers.get('ETag') ?? '' };
    },
  });

  async function setAsDefault(versionId: string) {
    if (read.data === undefined) {
      return;
    }
    setProblem(undefined);
    const { response } = await api.PATCH(
      '/api/rolls/{rollId}/frames/{frameId}',
      {
        params: {
          path: { rollId: roll.id, frameId: frame.id },
          header: { 'if-match': read.data.etag },
        },
        body: { defaultVersion: versionId },
      },
    );
    if (response.status === 409) {
      setProblem('This roll changed since you opened it. Reload the page.');
      return;
    }
    if (!response.ok) {
      setProblem("Couldn't change it. Is the service running?");
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ['rolls'] });
  }

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
                  onClick={() => void setAsDefault(version.id)}
                >
                  Set as default
                </button>
              )}
            </li>
          ))}
        </ol>
      )}
      {problem !== undefined && <p role="alert">{problem}</p>}
    </aside>
  );
}
