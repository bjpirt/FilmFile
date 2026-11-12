import type { ApiClient } from '@filmfile/contracts/client';
import type {
  FrameSelection,
  SearchFramesResponse,
} from '@filmfile/contracts/selections';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { searchable } from './selection-edit.ts';

/**
 * The frames on a selection, worked out by the service from the archive as it
 * is (the service decides what matches, D93), grouped by roll or event if
 * asked. Undefined until the first answer; while the selection changes, the
 * last answer stays until the next.
 */
export function useFrameSearch(
  api: ApiClient,
  selection: FrameSelection,
  groupBy?: 'roll' | 'event',
): {
  readonly found: SearchFramesResponse | undefined;
  readonly failed: boolean;
} {
  const wanted = {
    ...searchable(selection),
    ...(groupBy === undefined ? {} : { groupBy }),
  };
  const search = useQuery({
    queryKey: ['frames', 'search', wanted],
    queryFn: async () => {
      const { data } = await api.POST('/api/frames/search', { body: wanted });
      if (data === undefined) {
        throw new Error("Couldn't find the frames.");
      }
      return data;
    },
    placeholderData: keepPreviousData,
  });
  return { found: search.data, failed: search.isError };
}
