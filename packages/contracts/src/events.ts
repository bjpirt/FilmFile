import { z } from 'zod';
import { slug } from './slug.ts';

// Request and response shapes for events.

/** When an event happened: a year, then optionally month and day (D32). */
export const eventDate = z
  .string()
  .regex(
    /^\d{4}(-\d{2}(-\d{2})?)?$/,
    'must be a year, optionally with month and day, like 2026, 2026-09 or 2026-09-12',
  )
  .meta({ example: '2026-09' });

export const event = z
  .object({
    slug,
    name: z.string().meta({ example: 'Iceland 2026' }),
    date: eventDate.nullable(),
  })
  .meta({ id: 'Event' });

export const eventList = z
  .object({ events: z.array(event) })
  .meta({ id: 'EventList' });

export const createEventRequest = z
  .object({
    name: z.string().min(1).max(100).meta({
      description: 'What the event is called; its slug is made from it.',
    }),
    date: eventDate.nullable().optional(),
  })
  .meta({ id: 'CreateEventRequest' });

export const updateEventRequest = z
  .object({
    name: z.string().min(1).max(100).optional(),
    date: eventDate.nullable().optional(),
  })
  .meta({
    id: 'UpdateEventRequest',
    description:
      'The details to change. A detail left out stays as it is; a null date clears it. The slug never changes.',
  });

export const eventParams = z.object({ slug });

/** The event's version, from the ETag it was read with, so a changed event isn't overwritten. */
export const eventIfMatchHeader = z.object({
  'if-match': z
    .string()
    .optional()
    .meta({ description: "The event's ETag, from when it was read." }),
});

export type Event = z.infer<typeof event>;
