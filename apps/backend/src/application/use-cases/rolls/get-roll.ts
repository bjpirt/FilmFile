import type { ArchiveContext } from '../../../domain/shared/archive-context.ts';
import type { NotFound } from '../../../domain/shared/domain-error.ts';
import type { RollId } from '../../../domain/shared/ids.ts';
import { err, ok, type Result } from '../../../domain/shared/result.ts';
import type {
  RollRepository,
  VersionedRoll,
} from '../../ports/roll-repository.ts';

/** A roll, with the version token that lets a later save check it hasn't changed. */
export class GetRoll {
  readonly #rolls: RollRepository;

  constructor(rolls: RollRepository) {
    this.#rolls = rolls;
  }

  async execute(
    ctx: ArchiveContext,
    input: { readonly id: RollId },
  ): Promise<Result<VersionedRoll, NotFound>> {
    const found = await this.#rolls.get(ctx, input.id);
    return found === undefined
      ? err({ kind: 'not-found', entity: 'roll', id: input.id })
      : ok(found);
  }
}
