import type { ApiClient } from '@filmfile/contracts/client';
import type {
  Site,
  SitePublished,
  SitePublishProgress,
} from '@filmfile/contracts/sites';
import type { UseQueryResult } from '@tanstack/react-query';
import { useState, type SubmitEvent } from 'react';
import { issueFor } from '../forms/issue-for.ts';
import { Link } from '../routing.tsx';
import { cloudflareGuide } from '../settings/cloudflare-guide.ts';
import { publishedTime } from './published-time.ts';
import type { SaveOutcome } from './use-site-saver.ts';

type Target = NonNullable<Site['publish']>;
type Failure = NonNullable<SitePublishProgress['failure']>;

/** What's fixed in Settings, so its message links there. */
const fixedInSettings: ReadonlySet<Failure> = new Set([
  'no-account',
  'no-credentials',
  'keys-refused',
]);

const files = (n: number) =>
  `${n.toLocaleString('en-GB')} ${n === 1 ? 'file' : 'files'}`;

function OpenSettings() {
  return (
    <Link className="open-settings" to="/settings">
      Open Settings
    </Link>
  );
}

/** A message from the service, linking to Settings when that's where it's fixed. */
function Problem({
  message,
  failure,
}: {
  readonly message: string;
  readonly failure: Failure | null;
}) {
  return (
    <p role="alert">
      {message}
      {failure !== null && fixedInSettings.has(failure) && (
        <>
          {' '}
          <OpenSettings />
        </>
      )}
    </p>
  );
}

/** "Published 13 Nov 2026, 14:02, up to date", or how else the bucket stands. */
function standing(published: SitePublished): string | undefined {
  switch (published.stands) {
    case 'not-built':
      return 'Not built yet: Publish builds it first.';
    case 'not-published':
      return 'Not published';
    case 'up-to-date':
      return `Published ${publishedTime(published.publishedAt ?? '')}, up to date`;
    case 'needs-update':
      return `Published ${publishedTime(published.publishedAt ?? '')}: ${files(published.filesToUpdate)} to update`;
    case 'unknown':
      return undefined;
  }
}

/** How far a running publish has got. */
function progressOf(publish: SitePublishProgress): string {
  switch (publish.phase) {
    case 'building':
      return publish.total === 0
        ? 'Making images…'
        : `Making images: ${String(publish.done)} of ${String(publish.total)}`;
    case 'uploading':
      return `Uploading ${String(publish.done)} of ${String(publish.total)}`;
    case 'removing':
      return `Removing old files: ${String(publish.total)}`;
  }
}

/** The bucket and address, saved together with "Save" (FF-234). */
function TargetForm({
  target,
  saving,
  wasPublished,
  save,
}: {
  readonly target: Site['publish'];
  readonly saving: boolean;
  /** Whether the site is in its bucket now, so a new bucket leaves it behind. */
  readonly wasPublished: boolean;
  readonly save: (target: Target | null) => Promise<SaveOutcome>;
}) {
  const [bucket, setBucket] = useState(target?.bucket ?? '');
  const [address, setAddress] = useState(target?.address ?? '');
  const [refused, setRefused] = useState<unknown>(undefined);
  const [leftBehind, setLeftBehind] = useState<string | undefined>(undefined);
  const wanted = { bucket: bucket.trim(), address: address.trim() };
  const filled = wanted.bucket !== '' && wanted.address !== '';
  const empty = wanted.bucket === '' && wanted.address === '';
  const changed =
    wanted.bucket !== (target?.bucket ?? '') ||
    wanted.address !== (target?.address ?? '');
  const canSave =
    !saving && ((filled && changed) || (empty && target !== null));

  async function send(event: SubmitEvent) {
    event.preventDefault();
    setRefused(undefined);
    setLeftBehind(undefined);
    const before = target;
    const outcome = await save(empty ? null : wanted);
    if (outcome.kind === 'invalid') {
      setRefused(outcome.error);
      return;
    }
    if (
      outcome.kind === 'saved' &&
      wasPublished &&
      before !== null &&
      before.bucket !== outcome.site.publish?.bucket
    ) {
      setLeftBehind(before.bucket);
    }
  }

  const bucketProblem = issueFor(refused, ['publish', 'bucket']);
  const addressProblem = issueFor(refused, ['publish', 'address']);
  return (
    <form
      className="publish-target"
      aria-label="Where to publish"
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
          aria-describedby="publish-bucket-hint"
          onChange={(event) => {
            setBucket(event.target.value);
          }}
        />
      </label>
      <p id="publish-bucket-hint" className="muted">
        Use a bucket only for this site: files it doesn't have are removed.
      </p>
      <p>
        <a href={cloudflareGuide} target="_blank" rel="noreferrer">
          How to set up Cloudflare
        </a>
      </p>
      {bucketProblem !== undefined && (
        <p role="alert">The bucket {bucketProblem}.</p>
      )}
      <label>
        <span>Address</span>
        <input
          type="url"
          value={address}
          maxLength={500}
          spellCheck={false}
          autoComplete="off"
          placeholder="https://photos.example.com"
          onChange={(event) => {
            setAddress(event.target.value);
          }}
        />
      </label>
      {addressProblem !== undefined && (
        <p role="alert">The address {addressProblem}.</p>
      )}
      <div className="form-actions">
        <button type="submit" disabled={!canSave}>
          Save
        </button>
      </div>
      {leftBehind !== undefined && (
        <p role="status">
          The site stays in {leftBehind} until you empty it in Cloudflare.
        </p>
      )}
    </form>
  );
}

/**
 * Publishing a site to its bucket (FF-234): where it goes, how the bucket
 * stands against the built site, "Publish" (building first as needed) with
 * progress and "Cancel", "Unpublish…" after asking, and "View site".
 */
export function PublishPanel({
  api,
  site,
  published,
  frameCount,
  saving,
  building,
  unpublishing,
  setUnpublishing,
  saveTarget,
  changed,
}: {
  readonly api: ApiClient;
  readonly site: Site;
  /** How the bucket stands, asked by the page (`useSitePublished`). */
  readonly published: UseQueryResult<SitePublished>;
  /** How many frames are on the site now; undefined until known. */
  readonly frameCount: number | undefined;
  /** A change to the site is being saved. */
  readonly saving: boolean;
  /** The site is being built. */
  readonly building: boolean;
  readonly unpublishing: boolean;
  readonly setUnpublishing: (unpublishing: boolean) => void;
  readonly saveTarget: (target: Target | null) => Promise<SaveOutcome>;
  /** Something was published or unpublished: what depends on it is asked again. */
  readonly changed: () => void;
}) {
  const [confirming, setConfirming] = useState<
    'empty' | 'unpublish' | undefined
  >(undefined);
  const [starting, setStarting] = useState(false);
  const [problem, setProblem] = useState<
    { readonly message: string; readonly failure: Failure | null } | undefined
  >(undefined);
  const target = site.publish;
  const slug = site.slug;
  const data = target === null ? undefined : published.data;
  const latest = data?.publish ?? null;
  const publishing = latest?.state === 'running';
  const noAccount = data?.check?.failure === 'no-account';
  const isPublished =
    data?.stands === 'up-to-date' || data?.stands === 'needs-update';
  const busy = saving || building || publishing || unpublishing || starting;

  async function publish() {
    setConfirming(undefined);
    setProblem(undefined);
    setStarting(true);
    try {
      const { response, error } = await api.POST('/api/sites/{slug}/publish', {
        params: { path: { slug } },
      });
      if (!response.ok) {
        setProblem({
          message:
            response.status === 409
              ? 'The site is being built or unpublished. Try again when it’s done.'
              : (issueFor(error, ['cloudflareAccountId']) ??
                "Couldn't publish the site. Is the service running?"),
          failure:
            issueFor(error, ['cloudflareAccountId']) === undefined
              ? null
              : 'no-account',
        });
        return;
      }
      await published.refetch();
    } finally {
      setStarting(false);
    }
  }

  async function cancel() {
    await api.DELETE('/api/sites/{slug}/publish', {
      params: { path: { slug } },
    });
    await published.refetch();
  }

  async function unpublish() {
    setConfirming(undefined);
    setProblem(undefined);
    setUnpublishing(true);
    try {
      const { response, error } = await api.DELETE(
        '/api/sites/{slug}/published',
        { params: { path: { slug } } },
      );
      if (!response.ok) {
        const reason =
          typeof error === 'object' && 'reason' in error ? error.reason : null;
        const needsAccount = issueFor(error, ['cloudflareAccountId']);
        setProblem(
          reason !== null && typeof error === 'object' && 'error' in error
            ? { message: error.error, failure: reason }
            : needsAccount !== undefined
              ? { message: needsAccount, failure: 'no-account' }
              : {
                  message:
                    response.status === 409
                      ? 'The site is being built or published. Try again when it’s done.'
                      : "Couldn't unpublish the site. Is the service running?",
                  failure: null,
                },
        );
      }
      changed();
    } finally {
      setUnpublishing(false);
    }
  }

  function startPublish() {
    if (frameCount === 0) {
      setConfirming('empty');
    } else {
      void publish();
    }
  }

  return (
    <section className="publish-panel" aria-label="Publish">
      <h2>Publish</h2>
      <TargetForm
        target={target}
        saving={saving}
        wasPublished={isPublished}
        save={saveTarget}
      />
      {target === null ? (
        <p className="publish-state">Say where to publish the site.</p>
      ) : published.isError ? (
        <p role="alert">
          Couldn't load what's published.{' '}
          <button type="button" onClick={() => void published.refetch()}>
            Check again
          </button>
        </p>
      ) : data === undefined || (published.isFetching && !publishing) ? (
        <p role="status">Checking what's published…</p>
      ) : data.check !== null ? (
        <div className="publish-check">
          <Problem message={data.check.message} failure={data.check.failure} />
          {!noAccount && (
            <button type="button" onClick={() => void published.refetch()}>
              Check again
            </button>
          )}
        </div>
      ) : (
        <p className="publish-state" role="status">
          {standing(data)}
        </p>
      )}
      {publishing && <p role="status">{progressOf(latest)}</p>}
      {starting && <p role="status">Starting to publish…</p>}
      {unpublishing && <p role="status">Unpublishing…</p>}
      {latest?.state === 'cancelled' && (
        <p role="status">Publishing cancelled.</p>
      )}
      {latest?.state === 'failed' &&
        (latest.failure === 'build-failed' ? (
          <p role="alert">{latest.message}</p>
        ) : (
          <Problem
            message={`${latest.message ?? "Couldn't publish the site."} Files already uploaded stay.`}
            failure={latest.failure}
          />
        ))}
      {problem !== undefined && (
        <Problem message={problem.message} failure={problem.failure} />
      )}
      {confirming === 'empty' && target !== null && (
        <div
          role="alertdialog"
          aria-label="Publish an empty site"
          className="page-actions"
        >
          <p>
            This site has no frames. Publish it anyway? Everything else in{' '}
            {target.bucket} is removed.
          </p>
          <button
            type="button"
            className="primary"
            onClick={() => void publish()}
          >
            Publish
          </button>
          <button
            type="button"
            autoFocus
            onClick={() => {
              setConfirming(undefined);
            }}
          >
            Cancel
          </button>
        </div>
      )}
      {confirming === 'unpublish' && target !== null && data !== undefined && (
        <div
          role="alertdialog"
          aria-label={`Unpublish ${site.name}`}
          className="page-actions"
        >
          <p>
            Unpublish {site.name}? This removes {files(data.filesInBucket)} from{' '}
            {target.bucket}.
          </p>
          <button
            type="button"
            className="danger"
            onClick={() => void unpublish()}
          >
            Unpublish
          </button>
          <button
            type="button"
            autoFocus
            onClick={() => {
              setConfirming(undefined);
            }}
          >
            Cancel
          </button>
        </div>
      )}
      {confirming === undefined && (
        <div className="build-actions">
          {publishing ? (
            <button type="button" onClick={() => void cancel()}>
              Cancel
            </button>
          ) : (
            <button
              type="button"
              className="primary"
              disabled={target === null || noAccount || busy}
              onClick={startPublish}
            >
              Publish
            </button>
          )}
          <button
            type="button"
            disabled={
              target === null ||
              noAccount ||
              busy ||
              (data?.filesInBucket ?? 0) === 0
            }
            onClick={() => {
              setConfirming('unpublish');
            }}
          >
            Unpublish…
          </button>
          {isPublished && target !== null && (
            <a href={target.address} target="_blank" rel="noreferrer">
              View site
            </a>
          )}
        </div>
      )}
    </section>
  );
}
