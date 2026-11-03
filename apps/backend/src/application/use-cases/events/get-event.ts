import type { ArchiveContext } from '../../../domain/shared/archive-context.ts';
import type { NotFound } from '../../../domain/shared/domain-error.ts';
import { err, ok, type Result } from '../../../domain/shared/result.ts';
import type { Slug } from '../../../domain/shared/slug.ts';
import type {
  EventRepository,
  VersionedEvent,
} from '../../ports/event-repository.ts';

/** An event, with the version token that lets a later save check it hasn't changed. */
export class GetEvent {
  readonly #events: EventRepository;

  constructor(events: EventRepository) {
    this.#events = events;
  }

  async execute(
    ctx: ArchiveContext,
    input: { readonly slug: Slug },
  ): Promise<Result<VersionedEvent, NotFound>> {
    const found = await this.#events.get(ctx, input.slug);
    return found === undefined
      ? err({ kind: 'not-found', entity: 'event', id: input.slug })
      : ok(found);
  }
}
