import { parseEventDate } from '../../../domain/events/event-date.ts';
import type { ArchiveContext } from '../../../domain/shared/archive-context.ts';
import type {
  ConcurrencyConflict,
  NotFound,
  ValidationFailed,
} from '../../../domain/shared/domain-error.ts';
import { err, ok, type Result } from '../../../domain/shared/result.ts';
import { slugFor, type Slug } from '../../../domain/shared/slug.ts';
import type {
  EventRepository,
  VersionedEvent,
} from '../../ports/event-repository.ts';

/**
 * Changes an event's name or date. A detail left out stays as it is; a null
 * date clears it. The slug stays the same, so rolls stay in the event (D32).
 * Saved only if the event hasn't changed since the caller read it at
 * `expectedVersion`.
 */
export class UpdateEvent {
  readonly #events: EventRepository;

  constructor(events: EventRepository) {
    this.#events = events;
  }

  async execute(
    ctx: ArchiveContext,
    input: {
      readonly slug: Slug;
      readonly expectedVersion: string;
      readonly name?: string | undefined;
      readonly date?: string | null | undefined;
    },
  ): Promise<
    Result<VersionedEvent, NotFound | ConcurrencyConflict | ValidationFailed>
  > {
    const name = input.name?.trim();
    if (name !== undefined && slugFor(name) === undefined) {
      return err({
        kind: 'validation-failed',
        issues: [{ path: ['name'], message: 'must have a letter or digit' }],
      });
    }
    const date =
      input.date === undefined || input.date === null
        ? ok(input.date)
        : parseEventDate(input.date);
    if (!date.ok) {
      return date;
    }
    const current = await this.#events.get(ctx, input.slug);
    if (current === undefined) {
      return err({ kind: 'not-found', entity: 'event', id: input.slug });
    }
    const event = {
      ...current.event,
      ...(name === undefined ? {} : { name }),
      ...(date.value === undefined ? {} : { date: date.value }),
    };
    const saved = await this.#events.save(ctx, event, input.expectedVersion);
    return saved.ok ? ok({ event, version: saved.value }) : saved;
  }
}
