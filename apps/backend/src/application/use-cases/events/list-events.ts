import { newestFirst } from '../../../domain/events/event-date.ts';
import type { Event } from '../../../domain/events/event.ts';
import type { ArchiveContext } from '../../../domain/shared/archive-context.ts';
import type { EventRepository } from '../../ports/event-repository.ts';

/** Every event in the archive, newest first, with undated events last (D32). */
export class ListEvents {
  readonly #events: EventRepository;

  constructor(events: EventRepository) {
    this.#events = events;
  }

  async execute(ctx: ArchiveContext): Promise<readonly Event[]> {
    return [...(await this.#events.list(ctx))].sort(newestFirst);
  }
}
