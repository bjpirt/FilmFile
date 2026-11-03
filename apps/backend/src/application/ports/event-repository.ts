import type { Event } from '../../domain/events/event.ts';
import type { ArchiveContext } from '../../domain/shared/archive-context.ts';
import type { AlreadyExists } from '../../domain/shared/domain-error.ts';
import type { Result } from '../../domain/shared/result.ts';
import type { Slug } from '../../domain/shared/slug.ts';

/**
 * Where the archive's events are kept: a JSON file per event in the archive,
 * or memory in tests. Events are found by their slug.
 */
export interface EventRepository {
  /** Every event, ordered by name. */
  list(ctx: ArchiveContext): Promise<readonly Event[]>;

  get(ctx: ArchiveContext, slug: Slug): Promise<Event | undefined>;

  /** Adds a new event; fails if another event has its slug. */
  create(
    ctx: ArchiveContext,
    event: Event,
  ): Promise<Result<void, AlreadyExists>>;
}
