import type { ApiClient } from '@filmfile/contracts/client';
import type { SyncSettings } from '@filmfile/contracts/sync';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type SubmitEvent } from 'react';
import { issueFor } from '../forms/issue-for.ts';
import { SyncControls } from '../sync/sync-controls.tsx';

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
        // The header's status shows once a bucket is set (FF-226).
        void queryClient.invalidateQueries({ queryKey: ['sync'], exact: true });
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
  return (
    <section className="sync" aria-label="Sync">
      <h2>Sync</h2>
      <SyncForm
        key={`${saved.bucket ?? ''}/${saved.computerName ?? ''}`}
        api={api}
        saved={saved}
      />
      <SyncControls
        api={api}
        ready={accountSet && saved.bucket !== null}
        lastSyncedAt={saved.lastSyncedAt}
      />
    </section>
  );
}
