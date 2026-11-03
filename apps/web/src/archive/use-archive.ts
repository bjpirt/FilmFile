import type { Archive } from '@filmfile/contracts/archive';
import type { ApiClient } from '@filmfile/contracts/client';
import { useQuery } from '@tanstack/react-query';

/** The archive's details as read, with the ETag a change is sent against. */
export interface ReadArchive {
  readonly archive: Archive;
  readonly etag: string;
}

/** The archive's details, or null until it's set up (D43). */
export function useArchive(api: ApiClient) {
  return useQuery({
    queryKey: ['archive'],
    queryFn: async (): Promise<ReadArchive | null> => {
      const { data, response } = await api.GET('/api/archive');
      if (data !== undefined) {
        return { archive: data, etag: response.headers.get('ETag') ?? '' };
      }
      if (response.status === 404) {
        return null;
      }
      throw new Error("Couldn't load the archive.");
    },
  });
}
