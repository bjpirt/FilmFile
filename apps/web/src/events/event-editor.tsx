import type { ApiClient } from '@filmfile/contracts/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { EventForm, type EventDetails } from './event-form.tsx';

/** What to say when the service refuses an event's details. */
export function problemWith(status: number, name: string): string {
  switch (status) {
    case 409:
      return `There's already an event with a name like ${name}.`;
    case 422:
      return "That date doesn't exist. Check the day and month.";
    default:
      return "Couldn't save the event. Is the service running?";
  }
}

/** The form for changing an event, once the event as it is now has loaded. */
export function EventEditor({
  api,
  slug,
  close,
}: {
  readonly api: ApiClient;
  readonly slug: string;
  readonly close: () => void;
}) {
  const queryClient = useQueryClient();
  const event = useQuery({
    // Not ['events', slug], which the event page caches the event alone
    // under; still under ['events'], so saving an event refreshes both.
    queryKey: ['events', slug, 'with-version'],
    queryFn: async () => {
      const { data, response } = await api.GET('/api/events/{slug}', {
        params: { path: { slug } },
      });
      if (data === undefined) {
        throw new Error("Couldn't load the event.");
      }
      // The version the event was read at, sent back as If-Match with a change.
      return { event: data, etag: response.headers.get('ETag') ?? '' };
    },
  });

  async function save(details: EventDetails): Promise<string | undefined> {
    if (event.data === undefined) {
      return undefined;
    }
    const { response } = await api.PATCH('/api/events/{slug}', {
      params: { path: { slug }, header: { 'if-match': event.data.etag } },
      body: details,
    });
    if (response.status === 409) {
      return 'This event changed since you opened it. Cancel and edit it again.';
    }
    if (!response.ok) {
      return problemWith(response.status, details.name);
    }
    await queryClient.invalidateQueries({ queryKey: ['events'] });
    close();
    return undefined;
  }

  if (event.isPending) {
    return <p>Loading the event…</p>;
  }
  if (event.isError) {
    return <p role="alert">Couldn't load the event. Is the service running?</p>;
  }
  return (
    <EventForm
      label={`Edit ${event.data.event.name}`}
      initial={event.data.event}
      submit="Save event"
      save={save}
      cancel={close}
    />
  );
}
