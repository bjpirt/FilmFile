import type { ApiClient } from '@filmfile/contracts/client';
import { useQuery } from '@tanstack/react-query';

export function App({ api }: { readonly api: ApiClient }) {
  const health = useQuery({
    queryKey: ['health'],
    queryFn: async () => {
      const { data } = await api.GET('/api/health');
      if (data === undefined) {
        throw new Error('The service is not responding.');
      }
      return data;
    },
  });

  return (
    <main>
      <h1>FilmFile</h1>
      <p>
        {health.isPending
          ? 'Connecting to the service…'
          : health.isError
            ? 'The service is not responding.'
            : 'Connected to the service.'}
      </p>
    </main>
  );
}
