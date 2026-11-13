import type { ApiClient } from '@filmfile/contracts/client';
import type { SiteBuildProgress } from '@filmfile/contracts/sites';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

const photos = (n: number) => (n === 1 ? '1 photo' : `${String(n)} photos`);
const images = (n: number) => (n === 1 ? '1 image' : `${String(n)} images`);

/** "Site built in Sites/iceland-highlights: 24 photos (3 images made, 69 unchanged)." */
function builtMessage(slug: string, build: SiteBuildProgress): string {
  return `Site built in Sites/${slug}: ${photos(build.photos)} (${images(build.imagesMade)} made, ${String(build.imagesUnchanged)} unchanged).`;
}

/** How a build is asked for: as needed, or afresh with every image made again (FF-191). */
type BuildKind = 'build' | 'rebuild';

const buildLabel: Record<BuildKind, string> = {
  build: 'Build site',
  rebuild: 'Rebuild from scratch',
};

/**
 * Building a site: whether it's built and up to date, "Build site" (and,
 * once built, "Rebuild from scratch"), progress with "Cancel" while it runs,
 * and "Open site" to see it (D92).
 */
export function BuildPanel({
  api,
  slug,
  frameCount,
  saving,
}: {
  readonly api: ApiClient;
  readonly slug: string;
  /** How many frames are on the site now; undefined until known. */
  readonly frameCount: number | undefined;
  /** A change is being saved: building now would use the settings before it. */
  readonly saving: boolean;
}) {
  const [confirmingEmpty, setConfirmingEmpty] = useState<BuildKind | undefined>(
    undefined,
  );
  const [problem, setProblem] = useState<string | undefined>(undefined);
  const status = useQuery({
    queryKey: ['sites', slug, 'status'],
    queryFn: async () => {
      const { data } = await api.GET('/api/sites/{slug}/status', {
        params: { path: { slug } },
      });
      if (data === undefined) {
        throw new Error("Couldn't load how the site stands.");
      }
      return data;
    },
    // While it runs, ask how far it has got.
    refetchInterval: (query) =>
      query.state.data?.build?.state === 'running' ? 400 : false,
  });

  async function build(kind: BuildKind) {
    setConfirmingEmpty(undefined);
    setProblem(undefined);
    const { response } = await api.POST('/api/sites/{slug}/build', {
      params: {
        path: { slug },
        query: kind === 'rebuild' ? { fresh: 'true' } : {},
      },
    });
    if (!response.ok) {
      setProblem(
        response.status === 422
          ? `Sites/${slug} holds something else, so the site can't be built there.`
          : "Couldn't build the site. Is the service running?",
      );
      return;
    }
    await status.refetch();
  }

  async function cancel() {
    await api.DELETE('/api/sites/{slug}/build', {
      params: { path: { slug } },
    });
    await status.refetch();
  }

  if (status.isPending) {
    return <p>Loading how the site stands…</p>;
  }
  if (status.isError) {
    return <p role="alert">Couldn't load how the site stands.</p>;
  }
  const { freshness, message, build: latest } = status.data;
  const running = latest?.state === 'running';
  const built = freshness === 'up-to-date' || freshness === 'out-of-date';
  /** An empty site asks first; otherwise the build starts. */
  function start(kind: BuildKind) {
    if (frameCount === 0) {
      setConfirmingEmpty(kind);
    } else {
      void build(kind);
    }
  }
  return (
    <section className="build-panel" aria-label="Build">
      <h2>Build</h2>
      {freshness === 'in-the-way' ? (
        <p role="alert">{message}, so the site can't be built there.</p>
      ) : (
        <p className="build-state" role="status">
          {message}
        </p>
      )}
      {running && (
        <p role="status">
          {latest.total === 0
            ? 'Making images…'
            : `Making images: ${String(latest.done)} of ${String(latest.total)}`}
        </p>
      )}
      {latest?.state === 'done' && (
        <p role="status">{builtMessage(slug, latest)}</p>
      )}
      {latest?.state === 'cancelled' && <p role="status">Build cancelled.</p>}
      {latest?.state === 'failed' && (
        <p role="alert">Couldn't build the site.</p>
      )}
      {problem !== undefined && <p role="alert">{problem}</p>}
      {confirmingEmpty !== undefined ? (
        <div
          role="alertdialog"
          aria-label="Build an empty site"
          className="page-actions"
        >
          <p>This site has no frames. Build it anyway?</p>
          <button
            type="button"
            className="primary"
            onClick={() => void build(confirmingEmpty)}
          >
            {buildLabel[confirmingEmpty]}
          </button>
          <button
            type="button"
            autoFocus
            onClick={() => {
              setConfirmingEmpty(undefined);
            }}
          >
            Cancel
          </button>
        </div>
      ) : (
        <div className="build-actions">
          {running ? (
            <button type="button" onClick={() => void cancel()}>
              Cancel
            </button>
          ) : (
            <>
              <button
                type="button"
                className="primary"
                disabled={saving || freshness === 'in-the-way'}
                onClick={() => {
                  start('build');
                }}
              >
                {buildLabel.build}
              </button>
              {built && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    start('rebuild');
                  }}
                >
                  {buildLabel.rebuild}
                </button>
              )}
            </>
          )}
          {built && (
            <a href={`/built-sites/${slug}/`} target="_blank" rel="noreferrer">
              Open site
            </a>
          )}
        </div>
      )}
    </section>
  );
}
