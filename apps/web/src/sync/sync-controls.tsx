import type { ApiClient } from '@filmfile/contracts/client';
import type { SyncProgress } from '@filmfile/contracts/sync';
import { useState } from 'react';
import { firstIssueMessage } from '../forms/first-issue-message.ts';
import { Link } from '../routing.tsx';
import { formatBytes } from '../settings/format-bytes.ts';
import { publishedTime } from '../sites/published-time.ts';
import { files, progressWords } from './progress-words.ts';
import { timeLeftText } from './time-left-text.ts';
import { useSyncStatus } from './use-sync-status.ts';

type Failure = NonNullable<SyncProgress['failure']>;

/** Fixed in Settings, so the message links there. */
const fixedInSettings: ReadonlySet<Failure> = new Set([
  'no-account',
  'no-credentials',
  'keys-refused',
]);
/** Refused before anything was sent, so nothing was left part-way. */
const refusals: ReadonlySet<Failure> = new Set([
  'not-empty',
  'another-library',
  'no-account',
]);

const unfinished =
  "Sync didn't finish. Nothing already backed up was lost. Try again.";
const stopped =
  'Sync stopped. The next sync carries on where this one left off.';

/** How a sync went, when it didn't finish. */
function Failed({ run }: { readonly run: SyncProgress }) {
  if (run.state === 'cancelled') {
    return <p role="status">{stopped}</p>;
  }
  const failure = run.failure ?? 'other';
  return (
    <p role="alert">
      {run.message ?? "Couldn't sync."}
      {fixedInSettings.has(failure) && (
        <>
          {' '}
          <Link className="open-settings" to="/settings">
            Open Settings
          </Link>
        </>
      )}
      {!refusals.has(failure) && ` ${unfinished}`}
    </p>
  );
}

/**
 * "Sync" with its progress and "Cancel", when the last sync finished and
 * what it sent, or why it didn't finish (FF-225). Settings and the header's
 * sync panel (FF-226) both show it.
 */
export function SyncControls({
  api,
  ready,
  lastSyncedAt,
}: {
  readonly api: ApiClient;
  /** Whether the account ID and a bucket are set, so a sync can start. */
  readonly ready: boolean;
  /** When the last sync finished, until the service says. */
  readonly lastSyncedAt: string | null;
}) {
  const [starting, setStarting] = useState(false);
  const [problem, setProblem] = useState<string | undefined>(undefined);
  // Set the moment Cancel is pressed, before the service says it's stopping.
  const [cancelling, setCancelling] = useState(false);
  const status = useSyncStatus(api);

  async function sync() {
    setProblem(undefined);
    setCancelling(false);
    setStarting(true);
    try {
      const { response, error } = await api.POST('/api/sync');
      if (!response.ok) {
        setProblem(
          firstIssueMessage(error) ??
            "Couldn't start syncing. Is the service running?",
        );
        return;
      }
      await status.refetch();
    } finally {
      setStarting(false);
    }
  }

  async function cancel() {
    setCancelling(true);
    await api.DELETE('/api/sync');
    await status.refetch();
  }

  const run = status.data?.run ?? null;
  const running = run?.state === 'running' || run?.state === 'stopping';
  const stopping = run?.state === 'stopping' || (running && cancelling);
  const syncedAt = status.data?.lastSyncedAt ?? lastSyncedAt;
  const firstSync = status.data?.firstSync ?? null;
  return (
    <>
      {!ready ? (
        <p>Say which bucket to sync with.</p>
      ) : running ? (
        <>
          <p role="status">{progressWords(run)}</p>
          {run.secondsLeft !== null && (
            <p className="muted">{timeLeftText(run.secondsLeft)}</p>
          )}
        </>
      ) : (
        <p role="status">
          {syncedAt !== null
            ? `Synced ${publishedTime(syncedAt)}`
            : firstSync === null
              ? 'Not synced yet'
              : `The first sync didn't finish: ${formatBytes(firstSync.bytesBackedUp)} of ${formatBytes(firstSync.bytes)} backed up. Sync carries on from there.`}
        </p>
      )}
      {run?.state === 'done' && (
        <p className="muted">
          {run.filesDone === 0
            ? 'Nothing had changed.'
            : `Sent ${files(run.filesDone)} (${formatBytes(run.bytesDone)}).`}
        </p>
      )}
      {(run?.state === 'failed' || run?.state === 'cancelled') && (
        <Failed run={run} />
      )}
      {problem !== undefined && <p role="alert">{problem}</p>}
      <div className="form-actions">
        {running ? (
          <button
            type="button"
            disabled={stopping}
            onClick={() => void cancel()}
          >
            {stopping ? 'Stopping…' : 'Cancel'}
          </button>
        ) : (
          <button
            type="button"
            className="primary"
            disabled={!ready || starting}
            onClick={() => void sync()}
          >
            Sync
          </button>
        )}
      </div>
    </>
  );
}
