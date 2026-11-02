import type {
  AlreadyExists,
  NotFound,
} from '../../domain/shared/domain-error.ts';
import type { ArchiveContext } from '../../domain/shared/archive-context.ts';
import type { RollId } from '../../domain/shared/ids.ts';
import type { Roll } from '../../domain/rolls/roll.ts';
import type { Result } from '../../domain/shared/result.ts';

/**
 * Where rolls, with their frames and versions, are kept: `roll.json` files in
 * the archive, or memory in tests. Version tokens for safe concurrent saves
 * arrive in task H.9.
 */
export interface RollRepository {
  /** Every roll, ordered by roll number. */
  list(ctx: ArchiveContext): Promise<readonly Roll[]>;

  get(ctx: ArchiveContext, id: RollId): Promise<Roll | undefined>;

  /** Adds a new roll; fails if another roll has its roll number. */
  create(ctx: ArchiveContext, roll: Roll): Promise<Result<void, AlreadyExists>>;

  /** Replaces an existing roll. */
  save(ctx: ArchiveContext, roll: Roll): Promise<Result<void, NotFound>>;
}
