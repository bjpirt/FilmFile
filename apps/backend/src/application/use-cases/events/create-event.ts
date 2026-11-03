import { parseEventDate } from '../../../domain/events/event-date.ts';
import type { Event } from '../../../domain/events/event.ts';
import type { ArchiveContext } from '../../../domain/shared/archive-context.ts';
import type {
  AlreadyExists,
  ValidationFailed,
} from '../../../domain/shared/domain-error.ts';
import { err, ok, type Result } from '../../../domain/shared/result.ts';
import { slugFor } from '../../../domain/shared/slug.ts';
import type { EventRepository } from '../../ports/event-repository.ts';

/** Adds an event, named as given, with a slug made from its name and any date. */
export class CreateEvent {
  readonly #events: EventRepository;

  constructor(events: EventRepository) {
    this.#events = events;
  }

  async execute(
    ctx: ArchiveContext,
    input: { readonly name: string; readonly date?: string | null | undefined },
  ): Promise<Result<Event, ValidationFailed | AlreadyExists>> {
    const name = input.name.trim();
    const slug = slugFor(name);
    if (slug === undefined) {
      return err({
        kind: 'validation-failed',
        issues: [{ path: ['name'], message: 'must have a letter or digit' }],
      });
    }
    const date =
      input.date === undefined || input.date === null
        ? ok(null)
        : parseEventDate(input.date);
    if (!date.ok) {
      return date;
    }
    const event: Event = { slug, name, date: date.value };
    const created = await this.#events.create(ctx, event);
    return created.ok ? ok(event) : created;
  }
}
