import type { ApiClient } from '@filmfile/contracts/client';
import type { Event } from '@filmfile/contracts/events';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { formatShot } from '../rolls/format-shot.ts';
import { Link } from '../routing.tsx';
import { EventForm, type EventDetails } from './event-form.tsx';

function rollCount(count: number): string {
  return count === 1 ? '1 roll' : `${String(count)} rolls`;
}

/** What to say when the service refuses an event's details. */
function problemWith(status: number, name: string): string {
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
function EventEditor({
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

/** One event in the list: its name, date and how many rolls it has. */
function EventRow({
  event,
  rolls,
  edit,
}: {
  readonly event: Event;
  readonly rolls: number;
  readonly edit: () => void;
}) {
  return (
    <>
      <span className="event-name">
        <Link to={`/events/${event.slug}`}>{event.name}</Link>
        {event.date !== null && (
          <span className="muted"> · {formatShot(event.date)}</span>
        )}
      </span>
      <span className="muted">{rollCount(rolls)}</span>
      <button type="button" aria-label={`Edit ${event.name}`} onClick={edit}>
        Edit
      </button>
    </>
  );
}

/**
 * Every event, newest first, with how many rolls were shot at it, each
 * leading to its page of frames. Events are added and changed here (D32).
 */
export function EventsPage({ api }: { readonly api: ApiClient }) {
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | undefined>(undefined);
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
  const rolls = useQuery({
    queryKey: ['rolls'],
    queryFn: async () => {
      const { data } = await api.GET('/api/rolls');
      if (data === undefined) {
        throw new Error("Couldn't load the rolls.");
      }
      return data;
    },
  });

  async function add(details: EventDetails): Promise<string | undefined> {
    const { response } = await api.POST('/api/events', { body: details });
    if (!response.ok) {
      return problemWith(response.status, details.name);
    }
    await queryClient.invalidateQueries({ queryKey: ['events'] });
    setAdding(false);
    return undefined;
  }

  if (events.isPending || rolls.isPending) {
    return <p>Loading the events…</p>;
  }
  if (events.isError || rolls.isError) {
    return <p>Couldn't load the events. Is the service running?</p>;
  }
  return (
    <section>
      <div className="page-heading">
        <h1>Events</h1>
        {!adding && (
          <button
            type="button"
            className="primary"
            onClick={() => {
              setAdding(true);
            }}
          >
            New event
          </button>
        )}
      </div>
      {adding && (
        <EventForm
          label="New event"
          initial={{ name: '', date: null }}
          submit="Add event"
          save={add}
          cancel={() => {
            setAdding(false);
          }}
        />
      )}
      {events.data.length === 0 && !adding ? (
        <p>No events yet. Add one with New event.</p>
      ) : (
        <ul className="event-list">
          {events.data.map((event) => (
            <li key={event.slug}>
              {editing === event.slug ? (
                <EventEditor
                  api={api}
                  slug={event.slug}
                  close={() => {
                    setEditing(undefined);
                  }}
                />
              ) : (
                <EventRow
                  event={event}
                  rolls={
                    rolls.data.rolls.filter((roll) => roll.event === event.slug)
                      .length
                  }
                  edit={() => {
                    setEditing(event.slug);
                  }}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
