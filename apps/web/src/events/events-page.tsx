import type { ApiClient } from '@filmfile/contracts/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { EventCard } from './event-card.tsx';
import { EventEditor, problemWith } from './event-editor.tsx';
import { EventForm, type EventDetails } from './event-form.tsx';

/**
 * Every event, newest first, as cards like the rolls page's (U63): how many
 * rolls and photos are in each, each leading to its page of frames. Events are added and changed here (D32).
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
        <ul className="roll-grid event-grid">
          {events.data.map((event) =>
            editing === event.slug ? (
              // Across the grid, so the form has room.
              <li key={event.slug} className="event-editing">
                <EventEditor
                  api={api}
                  slug={event.slug}
                  close={() => {
                    setEditing(undefined);
                  }}
                />
              </li>
            ) : (
              <EventCard
                key={event.slug}
                event={event}
                rolls={rolls.data.rolls}
                edit={() => {
                  setEditing(event.slug);
                }}
              />
            ),
          )}
        </ul>
      )}
    </section>
  );
}
