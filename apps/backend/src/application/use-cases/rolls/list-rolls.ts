import type { ArchiveContext } from '../../../domain/shared/archive-context.ts';
import type {
  RollListing,
  RollRepository,
  VersionedRollListing,
} from '../../ports/roll-repository.ts';

/** Every roll, ordered by roll number, and any whose file can't be read. */
export class ListRolls {
  readonly #rolls: RollRepository;

  constructor(rolls: RollRepository) {
    this.#rolls = rolls;
  }

  // Listing can't fail in an expected way, so it returns the rolls, not a Result.
  execute(ctx: ArchiveContext): Promise<RollListing> {
    return this.#rolls.list(ctx);
  }

  executeVersioned(ctx: ArchiveContext): Promise<VersionedRollListing> {
    return this.#rolls.listVersioned(ctx);
  }
}
