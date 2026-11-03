import type { ApiClient } from '@filmfile/contracts/client';
import { useQuery } from '@tanstack/react-query';
import { Link } from '../routing.tsx';

function rollCount(count: number): string {
  return count === 1 ? '1 roll' : `${String(count)} rolls`;
}

/** Every event, with how many rolls were shot at it, each leading to those rolls. */
export function EventsPage({ api }: { readonly api: ApiClient }) {
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
      </div>
      {events.data.length === 0 ? (
        <p>
          No events yet. Add one to a roll from its details, with Event and Add
          new….
        </p>
      ) : (
        <ul className="event-list">
          {events.data.map((event) => (
            <li key={event.slug}>
              <Link to={`/?event=${event.slug}`}>{event.name}</Link>
              <span className="muted">
                {rollCount(
                  rolls.data.rolls.filter((roll) => roll.event === event.slug)
                    .length,
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
