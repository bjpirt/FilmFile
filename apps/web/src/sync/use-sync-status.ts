import type { ApiClient } from '@filmfile/contracts/client';
import { useQuery } from '@tanstack/react-query';

/**
 * How syncing stands (`GET /api/sync`), polled while a sync runs or stops. The header
 * and Settings share it, so a sync started in one shows in the other.
 */
export function useSyncStatus(api: ApiClient, enabled = true) {
  return useQuery({
    queryKey: ['sync'],
    enabled,
    queryFn: async () => {
      const { data } = await api.GET('/api/sync');
      if (data === undefined) {
        throw new Error("Couldn't load how syncing stands.");
      }
      return data;
    },
    refetchInterval: (query) => {
      const state = query.state.data?.run?.state;
      return state === 'running' || state === 'waiting' || state === 'stopping'
        ? 400
        : false;
    },
  });
}
