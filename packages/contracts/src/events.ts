import { z } from 'zod';
import { slug } from './slug.ts';

// Request and response shapes for events.

export const event = z
  .object({
    slug,
    name: z.string().meta({ example: 'Iceland 2026' }),
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
  })
  .meta({ id: 'CreateEventRequest' });

export type Event = z.infer<typeof event>;
