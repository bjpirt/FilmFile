import type { ArchiveContext } from '../../../domain/shared/archive-context.ts';
import type {
  ConcurrencyConflict,
  NotFound,
} from '../../../domain/shared/domain-error.ts';
import type { RollId } from '../../../domain/shared/ids.ts';
import type { Result } from '../../../domain/shared/result.ts';
import type { Clock } from '../../ports/clock.ts';
import type { HoldingArea } from '../../ports/holding-area.ts';
import type { RollRepository } from '../../ports/roll-repository.ts';

/**
 * Deletes a roll, frames and all (D38), if it hasn't changed since the caller
 * read it at `expectedVersion`. Nothing is lost: its whole folder goes to the
 * holding area.
 */
export class DeleteRoll {
  readonly #rolls: RollRepository;
  readonly #holding: HoldingArea;
  readonly #clock: Clock;

  constructor(rolls: RollRepository, holding: HoldingArea, clock: Clock) {
    this.#rolls = rolls;
    this.#holding = holding;
    this.#clock = clock;
  }

  execute(
    ctx: ArchiveContext,
    input: { readonly id: RollId; readonly expectedVersion: string },
  ): Promise<Result<void, NotFound | ConcurrencyConflict>> {
    return this.#rolls.remove(ctx, input.id, input.expectedVersion, (roll) =>
      this.#holding.holdRoll(ctx, {
        rollId: roll.id,
        roll: roll.roll,
        at: this.#clock.now(),
      }),
    );
  }
}
