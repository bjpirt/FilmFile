import type { ApiClient } from '@filmfile/contracts/client';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Asks whether exports of several frames can be written into a folder chosen
 * in the desktop app, rather than downloaded as a zip (D100): the service says
 * so when it was started by the app. Read once, and only when it's needed, so
 * the answer is there however quickly Download is pressed; a service that
 * can't be asked is taken to say no.
 */
export function useCanExportToFolder(api: ApiClient): () => Promise<boolean> {
  const queryClient = useQueryClient();
  return async () => {
    try {
      const health = await queryClient.query({
        queryKey: ['health'],
        queryFn: async () => {
          const { data } = await api.GET('/api/health');
          if (data === undefined) {
            throw new Error("Couldn't reach the service.");
          }
          return data;
        },
        staleTime: Infinity,
      });
      return health.exportToFolder;
    } catch {
      return false;
    }
  };
}
