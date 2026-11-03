import type { Event } from '../../domain/events/event.ts';
import type { ArchiveContext } from '../../domain/shared/archive-context.ts';
import type {
  AlreadyExists,
  ConcurrencyConflict,
  NotFound,
} from '../../domain/shared/domain-error.ts';
import type { Result } from '../../domain/shared/result.ts';
import type { Slug } from '../../domain/shared/slug.ts';

/**
 * An event and its version token. The token changes whenever the event is
 * saved; passing it back to `save` refuses the save if the event has changed
 * since it was read.
 */
export interface VersionedEvent {
  readonly event: Event;
  readonly version: string;
}

/**
 * Where the archive's events are kept: a JSON file per event in the archive,
 * or memory in tests. Events are found by their slug, which never changes.
 */
export interface EventRepository {
  /** Every event, ordered by name. */
  list(ctx: ArchiveContext): Promise<readonly Event[]>;

  get(ctx: ArchiveContext, slug: Slug): Promise<VersionedEvent | undefined>;

  /** Adds a new event; fails if another event has its slug. */
  create(
    ctx: ArchiveContext,
    event: Event,
  ): Promise<Result<void, AlreadyExists>>;

  /**
   * Replaces an event, if it hasn't changed since it was read as
   * `expectedVersion`. Returns the new version.
   */
  save(
    ctx: ArchiveContext,
    event: Event,
    expectedVersion: string,
  ): Promise<Result<string, NotFound | ConcurrencyConflict>>;
}
