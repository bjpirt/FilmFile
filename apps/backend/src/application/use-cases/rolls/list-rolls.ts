import type { Roll } from '../../../domain/rolls/roll.ts';
import type { ArchiveContext } from '../../../domain/shared/archive-context.ts';
import type { RollRepository } from '../../ports/roll-repository.ts';

/** Every roll, ordered by roll number. */
export class ListRolls {
  readonly #rolls: RollRepository;

  constructor(rolls: RollRepository) {
    this.#rolls = rolls;
  }

  // Listing can't fail in an expected way, so it returns the rolls, not a Result.
  execute(ctx: ArchiveContext): Promise<readonly Roll[]> {
    return this.#rolls.list(ctx);
  }
}
