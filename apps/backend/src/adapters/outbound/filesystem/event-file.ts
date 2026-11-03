import { z } from 'zod';
import {
  isEventDate,
  type EventDate,
} from '../../../domain/events/event-date.ts';
import type { Event } from '../../../domain/events/event.ts';

// The persistence model for an event: events/<slug>.json. The slug is the
// file name, so the file holds only the rest.

const currentSchema = 1;

const storedEvent = z.object({
  schema: z.literal(currentSchema),
  name: z.string().min(1),
  // Added after the first events were written, which read as having none.
  date: z
    .custom<EventDate>(
      (value) => typeof value === 'string' && isEventDate(value),
      'must be a date like 2026-09-12',
    )
    .nullable()
    .default(null),
});

type EventDetails = Omit<Event, 'slug'>;

/** The event's details in an event file's text; throws if the file isn't one. */
export function parseEventFile(text: string): EventDetails {
  const { name, date } = storedEvent.parse(JSON.parse(text));
  return { name, date };
}

/** An event as file text: keys in a fixed order, two-space indent, trailing newline. */
export function eventFileContent(event: EventDetails): string {
  const stored: z.input<typeof storedEvent> = {
    schema: currentSchema,
    name: event.name,
    date: event.date,
  };
  return `${JSON.stringify(stored, null, 2)}\n`;
}
