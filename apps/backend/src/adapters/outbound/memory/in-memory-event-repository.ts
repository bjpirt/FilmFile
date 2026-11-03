import type {
  EventRepository,
  VersionedEvent,
} from '../../../application/ports/event-repository.ts';
import type { Event } from '../../../domain/events/event.ts';
import type { ArchiveContext } from '../../../domain/shared/archive-context.ts';
import type {
  AlreadyExists,
  ConcurrencyConflict,
  NotFound,
} from '../../../domain/shared/domain-error.ts';
import { err, ok, type Result } from '../../../domain/shared/result.ts';
import type { Slug } from '../../../domain/shared/slug.ts';

/** Events kept in memory, for tests. Versions count up from 1 per save. */
export class InMemoryEventRepository implements EventRepository {
  readonly #events = new Map<Slug, VersionedEvent>();
  #saves = 0;

  #store(event: Event): string {
    this.#saves += 1;
    const version = String(this.#saves);
    this.#events.set(event.slug, { event, version });
    return version;
  }

  list(): Promise<readonly Event[]> {
    return Promise.resolve(
      [...this.#events.values()]
        .map((stored) => stored.event)
        .sort((a, b) =>
          a.name.localeCompare(b.name, undefined, {
            sensitivity: 'base',
            numeric: true,
          }),
        ),
    );
  }

  get(_ctx: ArchiveContext, slug: Slug): Promise<VersionedEvent | undefined> {
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
    this.#store(event);
    return Promise.resolve(ok(undefined));
  }

  save(
    _ctx: ArchiveContext,
    event: Event,
    expectedVersion: string,
  ): Promise<Result<string, NotFound | ConcurrencyConflict>> {
    const current = this.#events.get(event.slug);
    if (current === undefined) {
      return Promise.resolve(
        err({ kind: 'not-found', entity: 'event', id: event.slug }),
      );
    }
    if (current.version !== expectedVersion) {
      return Promise.resolve(
        err({ kind: 'concurrency-conflict', entity: 'event', id: event.slug }),
      );
    }
    return Promise.resolve(ok(this.#store(event)));
  }
}
