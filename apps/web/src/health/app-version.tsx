import type { ApiClient } from '@filmfile/contracts/client';
import { useQuery } from '@tanstack/react-query';
import { healthQuery } from './health-query.ts';

/**
 * Which FilmFile this is, "FilmFile 0.1.0", marked "(dev)" when run from
 * source (FF-194). Nothing until the service says, or if it can't.
 */
export function AppVersion({ api }: { readonly api: ApiClient }) {
  const { data } = useQuery(healthQuery(api));
  if (data === undefined) {
    return null;
  }
  return (
    <p className="muted app-version">
      {`FilmFile ${data.version}${data.dev ? ' (dev)' : ''}`}
    </p>
  );
}
