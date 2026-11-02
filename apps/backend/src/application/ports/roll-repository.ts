import type {
  AlreadyExists,
  NotFound,
} from '../../domain/shared/domain-error.ts';
import type { ArchiveContext } from '../../domain/shared/archive-context.ts';
import type { RollId } from '../../domain/shared/ids.ts';
import type { Roll } from '../../domain/rolls/roll.ts';
import type { UnreadableRoll } from '../../domain/rolls/unreadable-roll.ts';
import type { Result } from '../../domain/shared/result.ts';

/**
 * Where rolls, with their frames and versions, are kept: `roll.json` files in
 * the archive, or memory in tests. Version tokens for safe concurrent saves
 * arrive in task H.9.
 */
/** Every roll that can be read, and the ones that can't. */
export interface RollListing {
  /** Ordered by roll number. */
  readonly rolls: readonly Roll[];
  readonly unreadable: readonly UnreadableRoll[];
}

export interface RollRepository {
  /** Every roll; one that can't be read is reported, not allowed to hide the rest. */
  list(ctx: ArchiveContext): Promise<RollListing>;

  get(ctx: ArchiveContext, id: RollId): Promise<Roll | undefined>;

  /** Adds a new roll; fails if another roll has its roll number. */
  create(ctx: ArchiveContext, roll: Roll): Promise<Result<void, AlreadyExists>>;

  /** Replaces an existing roll. */
  save(ctx: ArchiveContext, roll: Roll): Promise<Result<void, NotFound>>;
}
