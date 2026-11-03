import type { EventRepository } from '../../../application/ports/event-repository.ts';
import type { Event } from '../../../domain/events/event.ts';
import type { ArchiveContext } from '../../../domain/shared/archive-context.ts';
import type { AlreadyExists } from '../../../domain/shared/domain-error.ts';
import { err, ok, type Result } from '../../../domain/shared/result.ts';
import type { Slug } from '../../../domain/shared/slug.ts';

/** Events kept in memory, for tests. */
export class InMemoryEventRepository implements EventRepository {
  readonly #events = new Map<Slug, Event>();

  list(): Promise<readonly Event[]> {
    return Promise.resolve(
      [...this.#events.values()].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, {
          sensitivity: 'base',
          numeric: true,
        }),
      ),
    );
  }

  get(_ctx: ArchiveContext, slug: Slug): Promise<Event | undefined> {
    return Promise.resolve(this.#events.get(slug));
  }

  create(
    _ctx: ArchiveContext,
    event: Event,
  ): Promise<Result<void, AlreadyExists>> {
    if (this.#events.has(event.slug)) {
      return Promise.resolve(
        err({ kind: 'already-exists', entity: 'event', id: event.slug }),
      );
    }
    this.#events.set(event.slug, event);
    return Promise.resolve(ok(undefined));
  }
}
