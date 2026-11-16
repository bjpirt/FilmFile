import type { ApiClient } from '@filmfile/contracts/client';
import type { SyncProgress, SyncSettings } from '@filmfile/contracts/sync';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type SubmitEvent } from 'react';
import { issueFor } from '../forms/issue-for.ts';
import { firstIssueMessage } from '../forms/first-issue-message.ts';
import { Link } from '../routing.tsx';
import { publishedTime } from '../sites/published-time.ts';
import { formatBytes } from './format-bytes.ts';

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

const files = (n: number) => `${String(n)} ${n === 1 ? 'file' : 'files'}`;

/** The bucket and this computer's name, saved together with "Save". */
function SyncForm({
  api,
  saved,
}: {
  readonly api: ApiClient;
  readonly saved: SyncSettings;
}) {
  const queryClient = useQueryClient();
  const [bucket, setBucket] = useState(saved.bucket ?? '');
  const [name, setName] = useState(saved.computerName ?? '');
  const [refused, setRefused] = useState<unknown>(undefined);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | undefined>(undefined);
  const wanted = { bucket: bucket.trim(), computerName: name.trim() };
  const changed =
    wanted.bucket !== (saved.bucket ?? '') ||
    wanted.computerName !== (saved.computerName ?? '');
  const canSave =
    !saving && wanted.bucket !== '' && wanted.computerName !== '' && changed;

  async function send(event: SubmitEvent) {
    event.preventDefault();
    setRefused(undefined);
    setProblem(undefined);
    setSaving(true);
    try {
      const { data, error, response } = await api.PUT('/api/sync/settings', {
        body: wanted,
      });
      if (data !== undefined) {
        queryClient.setQueryData(['sync', 'settings'], data);
        return;
      }
      if (response.status === 422) {
        setRefused(error);
        return;
      }
      setProblem("Couldn't save them. Is the service running?");
    } finally {
      setSaving(false);
    }
  }

  const bucketProblem = issueFor(refused, ['bucket']);
  const nameProblem = issueFor(refused, ['computerName']);
  return (
    <form
      className="sync-settings"
      aria-label="Where to sync"
      noValidate
      onSubmit={(event) => void send(event)}
    >
      <label>
        <span>Bucket</span>
        <input
          value={bucket}
          maxLength={100}
          spellCheck={false}
          autoComplete="off"
          onChange={(event) => {
            setBucket(event.target.value);
          }}
        />
      </label>
      {bucketProblem !== undefined && (
        <p role="alert">The bucket {bucketProblem}.</p>
      )}
      <label>
        <span>This computer's name</span>
        <input
          value={name}
          maxLength={60}
          onChange={(event) => {
            setName(event.target.value);
          }}
        />
      </label>
      {nameProblem !== undefined && <p role="alert">The name {nameProblem}.</p>}
      {problem !== undefined && <p role="alert">{problem}</p>}
      <div className="form-actions">
        <button type="submit" disabled={!canSave}>
          Save
        </button>
      </div>
    </form>
  );
}

/** How a sync went, when it didn't finish. */
function Failed({ run }: { readonly run: SyncProgress }) {
  if (run.state === 'cancelled') {
    return <p role="status">{unfinished}</p>;
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
 * Backing up the library (FF-225): this computer's bucket and name, kept by
 * the desktop app (D120), "Sync" with its progress and "Cancel", and when it
 * last finished. Without the app it says sync works there.
 */
export function SyncSection({
  api,
  accountSet,
}: {
  readonly api: ApiClient;
  /** Whether a Cloudflare account ID is set in Settings. */
  readonly accountSet: boolean;
}) {
  const [starting, setStarting] = useState(false);
  const [problem, setProblem] = useState<string | undefined>(undefined);
  const settings = useQuery({
    queryKey: ['sync', 'settings'],
    queryFn: async () => {
      const { data } = await api.GET('/api/sync/settings');
      if (data === undefined) {
        throw new Error("Couldn't load the sync settings.");
      }
      return data;
    },
  });
  const status = useQuery({
    queryKey: ['sync'],
    enabled: settings.data?.available === true,
    queryFn: async () => {
      const { data } = await api.GET('/api/sync');
      if (data === undefined) {
        throw new Error("Couldn't load how syncing stands.");
      }
      return data;
    },
    refetchInterval: (query) =>
      query.state.data?.run?.state === 'running' ? 400 : false,
  });

  async function sync() {
    setProblem(undefined);
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
    await api.DELETE('/api/sync');
    await status.refetch();
  }

  if (settings.isPending) {
    return null;
  }
  if (settings.isError) {
    return <p role="alert">Couldn't load the sync settings.</p>;
  }
  const saved = settings.data;
  if (!saved.available) {
    return (
      <section className="sync" aria-label="Sync">
        <h2>Sync</h2>
        <p>Sync works in the FilmFile app.</p>
      </section>
    );
  }
  const run = status.data?.run ?? null;
  const running = run?.state === 'running';
  const ready = accountSet && saved.bucket !== null;
  const lastSyncedAt = status.data?.lastSyncedAt ?? saved.lastSyncedAt;
  return (
    <section className="sync" aria-label="Sync">
      <h2>Sync</h2>
      <SyncForm
        key={`${saved.bucket ?? ''}/${saved.computerName ?? ''}`}
        api={api}
        saved={saved}
      />
      {!ready ? (
        <p>Say which bucket to sync with.</p>
      ) : running ? (
        <p role="status">
          Uploading {formatBytes(run.bytesDone)} of{' '}
          {formatBytes(run.bytesTotal)} ({String(run.filesDone)} of{' '}
          {files(run.filesTotal)})
        </p>
      ) : (
        <p role="status">
          {lastSyncedAt === null
            ? 'Not synced yet'
            : `Synced ${publishedTime(lastSyncedAt)}`}
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
          <button type="button" onClick={() => void cancel()}>
            Cancel
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
    </section>
  );
}
