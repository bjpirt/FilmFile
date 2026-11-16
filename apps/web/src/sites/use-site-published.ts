import type { ApiClient } from '@filmfile/contracts/client';
import { useQuery } from '@tanstack/react-query';

/**
 * How the site stands in its bucket, and how its latest publish went, asked
 * again while one runs (FF-234). Only asked once the site has a target.
 */
export function useSitePublished(
  api: ApiClient,
  slug: string,
  hasTarget: boolean,
) {
  return useQuery({
    queryKey: ['sites', slug, 'published'],
    enabled: hasTarget,
    queryFn: async () => {
      const { data } = await api.GET('/api/sites/{slug}/published', {
        params: { path: { slug } },
      });
      if (data === undefined) {
        throw new Error("Couldn't load what's published.");
      }
      return data;
    },
    refetchInterval: (query) =>
      query.state.data?.publish?.state === 'running' ? 400 : false,
  });
}
