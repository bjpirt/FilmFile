import type { ApiClient } from '@filmfile/contracts/client';
import type { FrameSelection } from '@filmfile/contracts/selections';
import type { Site } from '@filmfile/contracts/sites';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type SubmitEvent } from 'react';
import { navigate } from '../routing.tsx';
import { FrameSelectionEditor } from '../selections/frame-selection-editor.tsx';
import { HiddenFramesList } from '../selections/hidden-frames-list.tsx';
import {
  isPinned,
  leaveOff,
  pin,
  putBack,
} from '../selections/selection-edit.ts';
import { useFrameSearch } from '../selections/use-frame-search.ts';
import { BuildPanel } from './build-panel.tsx';
import { PresentationFields } from './presentation-fields.tsx';
import { useSiteSaver } from './use-site-saver.ts';

/** A site opened, once it has loaded: its name and its selection, every change saved as it's made. */
function SiteEditor({
  api,
  site: loaded,
  etag,
}: {
  readonly api: ApiClient;
  readonly site: Site;
  readonly etag: string;
}) {
  const queryClient = useQueryClient();
  const [site, setSite] = useState(loaded);
  const [name, setName] = useState(loaded.name);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteFailed, setDeleteFailed] = useState(false);
  const rolls = useQuery({
    queryKey: ['rolls'],
    queryFn: async () => {
      const { data } = await api.GET('/api/rolls');
      if (data === undefined) {
        throw new Error("Couldn't load the rolls.");
      }
      return data;
    },
  });
  const found = useFrameSearch(api, site.selection).found;
  const saver = useSiteSaver({
    api,
    slug: loaded.slug,
    etag,
    saved: (saved) => {
      void queryClient.invalidateQueries({ queryKey: ['sites'], exact: true });
      // Whether the site is up to date depends on what was just changed.
      void queryClient.invalidateQueries({
        queryKey: ['sites', saved.slug, 'status'],
      });
      if (window.location.pathname !== `/sites/${saved.slug}`) {
        // The address follows the name.
        navigate(`/sites/${saved.slug}`, { replace: true });
      }
      setSite((now) => ({ ...now, slug: saved.slug, name: saved.name }));
    },
  });

  function select(selection: FrameSelection) {
    setSite({ ...site, selection });
    void saver.save({ selection });
  }

  function present(presentation: Site['presentation']) {
    setSite({ ...site, presentation });
    void saver.save({ presentation });
  }

  function rename(event: SubmitEvent) {
    event.preventDefault();
    const wanted = name.trim();
    if (wanted !== '' && wanted !== site.name) {
      void saver.save({ name: wanted });
    }
  }

  async function remove() {
    const { response } = await api.DELETE('/api/sites/{slug}', {
      params: { path: { slug: site.slug } },
    });
    if (!response.ok) {
      setDeleteFailed(true);
      setConfirmingDelete(false);
      return;
    }
    // Leave first: this page's own copy would only be fetched again to find it gone.
    navigate('/sites');
    void queryClient.invalidateQueries({ queryKey: ['sites'] });
  }

  return (
    <section className="site-page">
      <div className="page-heading">
        <h1>{site.name}</h1>
        {confirmingDelete ? (
          <div
            role="alertdialog"
            aria-label={`Delete site ${site.name}`}
            className="page-actions"
          >
            <p>Delete site {site.name}?</p>
            <button
              type="button"
              className="danger"
              onClick={() => void remove()}
            >
              Delete site
            </button>
            <button
              type="button"
              autoFocus
              onClick={() => {
                setConfirmingDelete(false);
              }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setConfirmingDelete(true);
            }}
          >
            Delete site…
          </button>
        )}
      </div>
      {deleteFailed && (
        <p role="alert">Couldn't delete the site. Is the service running?</p>
      )}
      <form
        className="site-name"
        aria-label="Site details"
        noValidate
        onSubmit={rename}
      >
        <label>
          <span>Name</span>
          <input
            value={name}
            maxLength={100}
            onChange={(event) => {
              setName(event.target.value);
            }}
          />
        </label>
        <button type="submit" disabled={name.trim() === site.name}>
          Rename
        </button>
      </form>
      {saver.state === 'conflict' && (
        <p role="alert">
          This site changed since you opened it. Reload the page.
        </p>
      )}
      {saver.state === 'name-taken' && (
        <p role="alert">There's already a site with a name like {name}.</p>
      )}
      {saver.state === 'failed' && (
        <p role="alert">Couldn't save the site. Is the service running?</p>
      )}
      <PresentationFields presentation={site.presentation} change={present} />
      <BuildPanel
        api={api}
        slug={site.slug}
        frameCount={found?.count}
        saving={saver.state === 'saving'}
      />
      <FrameSelectionEditor
        api={api}
        selection={site.selection}
        change={select}
        frameActions={(frame, frameName) => (
          <div className="frame-choices">
            {isPinned(site.selection, frame) ? (
              <button
                type="button"
                aria-label={`Don't always include ${frameName}`}
                onClick={() => {
                  select(putBack(site.selection, frame));
                }}
              >
                Don't always include
              </button>
            ) : (
              <button
                type="button"
                aria-label={`Always include ${frameName}`}
                onClick={() => {
                  select(pin(site.selection, frame));
                }}
              >
                Always include
              </button>
            )}
            <button
              type="button"
              aria-label={`Never include ${frameName}`}
              onClick={() => {
                select(leaveOff(site.selection, frame));
              }}
            >
              Never include
            </button>
          </div>
        )}
      />
      {rolls.data !== undefined && (
        <HiddenFramesList
          rolls={rolls.data.rolls}
          hidden={site.selection.hidden}
          putBack={(frame) => {
            select(putBack(site.selection, frame));
          }}
        />
      )}
    </section>
  );
}

/** A site's page (D91): its name, and the frames on it, found by rules and by hand. */
export function SitePage({
  api,
  slug,
}: {
  readonly api: ApiClient;
  readonly slug: string;
}) {
  const site = useQuery({
    queryKey: ['sites', slug, 'with-version'],
    // The page is the one editing it: what it holds then is its own.
    staleTime: Infinity,
    gcTime: 0,
    queryFn: async () => {
      const { data, response } = await api.GET('/api/sites/{slug}', {
        params: { path: { slug } },
      });
      if (data === undefined) {
        throw new Error(String(response.status));
      }
      return { site: data, etag: response.headers.get('ETag') ?? '' };
    },
  });

  if (site.isPending) {
    return <p>Loading the site…</p>;
  }
  if (site.isError) {
    return site.error.message === '404' ? (
      <p>There is no such site.</p>
    ) : (
      <p>Couldn't load the site. Is the service running?</p>
    );
  }
  return <SiteEditor api={api} site={site.data.site} etag={site.data.etag} />;
}
