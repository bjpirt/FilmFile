import type { ApiClient } from '@filmfile/contracts/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type SubmitEvent } from 'react';
import { Link, navigate } from '../routing.tsx';

function NewSiteForm({
  api,
  cancel,
}: {
  readonly api: ApiClient;
  readonly cancel: () => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [problem, setProblem] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);

  async function add(event: SubmitEvent) {
    event.preventDefault();
    const wanted = name.trim();
    if (wanted === '') {
      setProblem('Enter a name for the site, like Iceland highlights.');
      return;
    }
    setProblem(undefined);
    setSaving(true);
    const { data, response } = await api.POST('/api/sites', {
      body: { name: wanted },
    });
    setSaving(false);
    if (data === undefined) {
      setProblem(
        response.status === 409
          ? `There's already a site with a name like ${wanted}.`
          : response.status === 422
            ? 'Use a name with at least a letter or a digit.'
            : "Couldn't add the site. Is the service running?",
      );
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ['sites'] });
    navigate(`/sites/${data.slug}`);
  }

  return (
    <form
      className="roll-details site-form"
      aria-label="New site"
      noValidate
      onSubmit={(event) => void add(event)}
    >
      <label>
        <span>Name</span>
        <input
          value={name}
          placeholder="Iceland highlights"
          maxLength={100}
          autoFocus
          onChange={(event) => {
            setName(event.target.value);
          }}
        />
      </label>
      {problem !== undefined && <p role="alert">{problem}</p>}
      <div className="form-actions">
        <button type="submit" className="primary" disabled={saving}>
          Add site
        </button>
        <button type="button" onClick={cancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

/** Every site by name, each with how many frames are on it now (D91); new ones are added here. */
export function SitesPage({ api }: { readonly api: ApiClient }) {
  const [adding, setAdding] = useState(false);
  const sites = useQuery({
    queryKey: ['sites'],
    queryFn: async () => {
      const { data } = await api.GET('/api/sites');
      if (data === undefined) {
        throw new Error("Couldn't load the sites.");
      }
      return data.sites;
    },
  });

  if (sites.isPending) {
    return <p>Loading the sites…</p>;
  }
  if (sites.isError) {
    return <p>Couldn't load the sites. Is the service running?</p>;
  }
  return (
    <section>
      <div className="page-heading">
        <h1>Sites</h1>
        {!adding && (
          <button
            type="button"
            className="primary"
            onClick={() => {
              setAdding(true);
            }}
          >
            New site
          </button>
        )}
      </div>
      {adding && (
        <NewSiteForm
          api={api}
          cancel={() => {
            setAdding(false);
          }}
        />
      )}
      {sites.data.length === 0 && !adding ? (
        <p>No sites yet. Make one to share a set of frames.</p>
      ) : (
        <ul className="site-list">
          {sites.data.map((site) => (
            <li key={site.slug}>
              <Link to={`/sites/${site.slug}`}>{site.name}</Link>{' '}
              <span className="site-count">
                {site.frameCount === 1
                  ? '1 frame'
                  : `${String(site.frameCount)} frames`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
