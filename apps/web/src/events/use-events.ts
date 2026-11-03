import type { ApiClient } from '@filmfile/contracts/client';
import type { Event } from '@filmfile/contracts/events';
import { useQuery } from '@tanstack/react-query';

/** The archive's events, ordered by name; none until they've loaded. */
export function useEvents(api: ApiClient): readonly Event[] {
  const events = useQuery({
    queryKey: ['events'],
    queryFn: async () => {
      const { data } = await api.GET('/api/events');
      if (data === undefined) {
        throw new Error("Couldn't load the events.");
      }
      return data.events;
    },
  });
  return events.data ?? [];
}

/** What a roll's event is called; its slug if the event isn't known. */
export function eventName(
  events: readonly Event[],
  slug: string | null,
): string | undefined {
  if (slug === null) {
    return undefined;
  }
  return events.find((event) => event.slug === slug)?.name ?? slug;
}
