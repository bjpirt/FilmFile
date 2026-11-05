import type { Roll } from '../../domain/rolls/roll.ts';
import type { UnreadableRoll } from '../../domain/rolls/unreadable-roll.ts';
import type { ArchiveContext } from '../../domain/shared/archive-context.ts';
import type {
  AlreadyExists,
  ConcurrencyConflict,
  NotFound,
} from '../../domain/shared/domain-error.ts';
import type { RollId } from '../../domain/shared/ids.ts';
import type { Result } from '../../domain/shared/result.ts';

/** Every roll that can be read, and the ones that can't. */
export interface RollListing {
  /** Ordered by roll number. */
  readonly rolls: readonly Roll[];
  readonly unreadable: readonly UnreadableRoll[];
}

/**
 * A roll and its version token. The token changes whenever the roll is
 * saved; passing it back to `save` refuses the save if the roll has changed
 * since it was read.
 */
export interface VersionedRoll {
  readonly roll: Roll;
  readonly version: string;
}

/** The roll to save in place of the one read, and what to give the caller. */
export interface RollChange<T> {
  readonly roll: Roll;
  readonly value: T;
}

/**
 * Where rolls, with their frames and versions, are kept: roll.json files in
 * the archive, or memory in tests. Every write replaces a roll whole and
 * atomically: a reader sees the old roll or the new one, never part of each.
 */
export interface RollRepository {
  /** Every roll; one that can't be read is reported, not allowed to hide the rest. */
  list(ctx: ArchiveContext): Promise<RollListing>;

  get(ctx: ArchiveContext, id: RollId): Promise<VersionedRoll | undefined>;

  /** Adds a new roll; fails if another roll has its roll number. */
  create(ctx: ArchiveContext, roll: Roll): Promise<Result<void, AlreadyExists>>;

  /**
   * Replaces a roll, if it hasn't changed since it was read as
   * `expectedVersion`. Returns the new version. It never changes the roll's
   * number, which is `saveRenumbered`'s alone: a roll saved with another
   * number than it has is a bug, and throws.
   */
  save(
    ctx: ArchiveContext,
    roll: Roll,
    expectedVersion: string,
  ): Promise<Result<string, NotFound | ConcurrencyConflict>>;

  /**
   * Replaces a roll whose number may have changed, if it hasn't changed
   * since it was read as `expectedVersion`; the one way a number changes
   * (D70). Fails, changing nothing, if another roll has the new number; no
   * two requests can both take a number. A roll's storage moves with its
   * number (D66). Returns the new version.
   */
  saveRenumbered(
    ctx: ArchiveContext,
    roll: Roll,
    expectedVersion: string,
  ): Promise<Result<string, NotFound | ConcurrencyConflict | AlreadyExists>>;

  /**
   * Reads the roll, applies `apply` and saves what it returns, with no other
   * change to the roll in between. For appends, such as adding a frame, which
   * need no version token from the caller (D11). `apply` may fail, and then
   * nothing is saved. Like `save`, it throws if `apply` changes the number.
   */
  change<T, E>(
    ctx: ArchiveContext,
    id: RollId,
    apply: (roll: Roll) => Promise<Result<RollChange<T>, E>>,
  ): Promise<Result<T, E | NotFound>>;

  /**
   * Removes a roll, if it hasn't changed since it was read as
   * `expectedVersion`, by handing it to `handOver`, which takes its files
   * away (into the holding area), with no other change to the roll in
   * between. Afterwards the roll is gone.
   */
  remove(
    ctx: ArchiveContext,
    id: RollId,
    expectedVersion: string,
    handOver: (roll: Roll) => Promise<void>,
  ): Promise<Result<void, NotFound | ConcurrencyConflict>>;
}
