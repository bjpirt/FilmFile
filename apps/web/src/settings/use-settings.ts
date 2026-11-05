import type { ApiClient } from '@filmfile/contracts/client';
import type { Settings } from '@filmfile/contracts/settings';
import { useQuery } from '@tanstack/react-query';

/** The settings as read, with the ETag a change is sent against. */
export interface ReadSettings {
  readonly settings: Settings;
  readonly etag: string;
}

/** FilmFile's settings, or null until it's set up (D43). */
export function useSettings(api: ApiClient) {
  return useQuery({
    queryKey: ['settings'],
    queryFn: async (): Promise<ReadSettings | null> => {
      const { data, response } = await api.GET('/api/settings');
      if (data !== undefined) {
        return { settings: data, etag: response.headers.get('ETag') ?? '' };
      }
      if (response.status === 404) {
        return null;
      }
      throw new Error("Couldn't load the settings.");
    },
  });
}
