import type { ApiClient } from '@filmfile/contracts/client';
import { RollPage } from './rolls/roll-page.tsx';
import { RollsPage } from './rolls/rolls-page.tsx';
import { Link, usePath } from './routing.tsx';

const rollPath = /^\/rolls\/([0-9A-HJKMNP-TV-Z]{26})$/;

function Page({
  api,
  path,
}: {
  readonly api: ApiClient;
  readonly path: string;
}) {
  if (path === '/') {
    return <RollsPage api={api} />;
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

export function App({ api }: { readonly api: ApiClient }) {
  const path = usePath();
  return (
    <>
      <header className="app-header">
        <Link to="/" className="app-name">
          FilmFile
        </Link>
        <nav aria-label="Main">
          <Link to="/" current={path === '/' || path.startsWith('/rolls/')}>
            Rolls
          </Link>
        </nav>
      </header>
      <main className="page">
        <Page api={api} path={path} />
      </main>
    </>
  );
}
