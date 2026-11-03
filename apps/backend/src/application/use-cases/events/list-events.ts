import type { Event } from '../../../domain/events/event.ts';
import type { ArchiveContext } from '../../../domain/shared/archive-context.ts';
import type { EventRepository } from '../../ports/event-repository.ts';

/** Every event in the archive, ordered by name. */
export class ListEvents {
  readonly #events: EventRepository;

  constructor(events: EventRepository) {
    this.#events = events;
  }

  execute(ctx: ArchiveContext): Promise<readonly Event[]> {
    return this.#events.list(ctx);
  }
}
