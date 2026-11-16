import type { ApiClient } from '@filmfile/contracts/client';
import { useQuery } from '@tanstack/react-query';

/** Whether the site is built and up to date, and how its latest build went, asked again while one runs. */
export function useSiteStatus(api: ApiClient, slug: string) {
  return useQuery({
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
}
