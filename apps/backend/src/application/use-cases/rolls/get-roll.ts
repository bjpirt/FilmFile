import type { Roll } from '../../../domain/rolls/roll.ts';
import type { ArchiveContext } from '../../../domain/shared/archive-context.ts';
import type { NotFound } from '../../../domain/shared/domain-error.ts';
import type { RollId } from '../../../domain/shared/ids.ts';
import { err, ok, type Result } from '../../../domain/shared/result.ts';
import type { RollRepository } from '../../ports/roll-repository.ts';

export class GetRoll {
  readonly #rolls: RollRepository;

  constructor(rolls: RollRepository) {
    this.#rolls = rolls;
  }

  async execute(
    ctx: ArchiveContext,
    input: { readonly id: RollId },
  ): Promise<Result<Roll, NotFound>> {
    const roll = await this.#rolls.get(ctx, input.id);
    return roll === undefined
      ? err({ kind: 'not-found', entity: 'roll', id: input.id })
      : ok(roll);
  }
}
