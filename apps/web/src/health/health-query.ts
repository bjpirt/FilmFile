import type { ApiClient } from '@filmfile/contracts/client';

/**
 * Asks the service how it is: whether it can export into a folder (D100) and
 * which version it is (FF-194). Neither changes while the page is open, so
 * it's asked once.
 */
export function healthQuery(api: ApiClient) {
  return {
    queryKey: ['health'],
    queryFn: async () => {
      const { data } = await api.GET('/api/health');
      if (data === undefined) {
        throw new Error("Couldn't reach the service.");
      }
      return data;
    },
    staleTime: Infinity,
  } as const;
}
