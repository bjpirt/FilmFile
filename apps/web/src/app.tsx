import type { ApiClient } from '@filmfile/contracts/client';
import { RollsPage } from './rolls/rolls-page.tsx';

export function App({ api }: { readonly api: ApiClient }) {
  return (
    <main>
      <h1>FilmFile</h1>
      <RollsPage api={api} />
    </main>
  );
}
