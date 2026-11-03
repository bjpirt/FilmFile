import type { Slug } from '../shared/slug.ts';
import type { EventDate } from './event-date.ts';

/** Something that happened, which rolls were shot at, e.g. "Iceland 2026". */
export interface Event {
  readonly slug: Slug;
  readonly name: string;
  /** When it happened, as precisely as it's known, or null (D32). */
  readonly date: EventDate | null;
}
