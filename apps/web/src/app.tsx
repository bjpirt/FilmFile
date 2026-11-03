import type { ApiClient } from '@filmfile/contracts/client';
import { EventsPage } from './events/events-page.tsx';
import { NewRollPage } from './rolls/new-roll-page.tsx';
import { RollPage } from './rolls/roll-page.tsx';
import { useState } from 'react';
import { RollsPage } from './rolls/rolls-page.tsx';
import {
  rememberBrowseOpen,
  rememberedBrowseOpen,
} from './rolls/view-preference.ts';
import { Link, usePath } from './routing.tsx';

const rollPath = /^\/rolls\/([0-9A-HJKMNP-TV-Z]{26})$/;

function Page({
  api,
  path,
  browseOpen,
}: {
  readonly api: ApiClient;
  readonly path: string;
  readonly browseOpen: boolean;
}) {
  if (path === '/') {
    return <RollsPage api={api} browseOpen={browseOpen} />;
  }
  if (path === '/events') {
    return <EventsPage api={api} />;
  }
  if (path === '/rolls/new') {
    return <NewRollPage api={api} />;
  }
  const rollId = rollPath.exec(path)?.[1];
  if (rollId !== undefined) {
    return <RollPage api={api} rollId={rollId} />;
  }
  return (
    <p>
      There is no page here. <Link to="/">All rolls</Link>
    </p>
  );
}

/** Opens and closes the browse panel: a panel icon, named for what it will do. */
function BrowseToggle({
  open,
  toggle,
}: {
  readonly open: boolean;
  readonly toggle: () => void;
}) {
  const label = open ? 'Hide the browse panel' : 'Show the browse panel';
  return (
    <button
      type="button"
      className="icon-button"
      aria-label={label}
      title={label}
      aria-expanded={open}
      aria-controls="browse"
      onClick={toggle}
    >
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <line x1="9" y1="4" x2="9" y2="20" />
      </svg>
    </button>
  );
}

export function App({ api }: { readonly api: ApiClient }) {
  const path = usePath();
  const [browseOpen, setBrowseOpen] = useState(rememberedBrowseOpen);
  return (
    <>
      <header className="app-header">
        <div className="app-brand">
          {path === '/' && (
            <BrowseToggle
              open={browseOpen}
              toggle={() => {
                rememberBrowseOpen(!browseOpen);
                setBrowseOpen(!browseOpen);
              }}
            />
          )}
          <Link to="/" className="app-name">
            FilmFile
          </Link>
        </div>
        <nav aria-label="Main">
          <Link to="/" current={path === '/' || path.startsWith('/rolls/')}>
            Rolls
          </Link>
          <Link to="/events" current={path === '/events'}>
            Events
          </Link>
        </nav>
      </header>
      <main className="page">
        <Page api={api} path={path} browseOpen={browseOpen} />
      </main>
    </>
  );
}
