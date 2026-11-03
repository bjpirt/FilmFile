import { z } from 'zod';
import type { Event } from '../../../domain/events/event.ts';

// The persistence model for an event: events/<slug>.json. The slug is the
// file name, so the file holds only the rest.

const currentSchema = 1;

const storedEvent = z.object({
  schema: z.literal(currentSchema),
  name: z.string().min(1),
});

type EventDetails = Omit<Event, 'slug'>;

/** The event's details in an event file's text; throws if the file isn't one. */
export function parseEventFile(text: string): EventDetails {
  const { name } = storedEvent.parse(JSON.parse(text));
  return { name };
}

/** An event as file text: keys in a fixed order, two-space indent, trailing newline. */
export function eventFileContent(event: EventDetails): string {
  const stored: z.input<typeof storedEvent> = {
    schema: currentSchema,
    name: event.name,
  };
  return `${JSON.stringify(stored, null, 2)}\n`;
}
