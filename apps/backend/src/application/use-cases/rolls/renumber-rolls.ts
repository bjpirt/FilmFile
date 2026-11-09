import type { RollRepository } from '../../ports/roll-repository.ts';
import type { ArchiveContext } from '../../../domain/shared/archive-context.ts';
import type {
  AlreadyExists,
  ConcurrencyConflict,
  ValidationFailed,
} from '../../../domain/shared/domain-error.ts';
import { parseRollNumber } from '../../../domain/rolls/roll-number.ts';
import { parseRollId } from '../../../domain/shared/ids.ts';
import type { Result } from '../../../domain/shared/result.ts';
import type { UnreadableRoll } from '../../../domain/rolls/unreadable-roll.ts';

/** Applies a set of roll-number changes against the complete preview snapshot. */
export class RenumberRolls {
  readonly #rolls: RollRepository;

  constructor(rolls: RollRepository) {
    this.#rolls = rolls;
  }

  execute(
    ctx: ArchiveContext,
    input: {
      readonly snapshot: readonly {
        readonly id: string;
        readonly version: string;
      }[];
      readonly unreadable: readonly UnreadableRoll[];
      readonly changes: readonly {
        readonly id: string;
        readonly roll: string;
      }[];
    },
  ): Promise<
    Result<void, AlreadyExists | ConcurrencyConflict | ValidationFailed>
  > {
    const snapshot = [];
    for (const entry of input.snapshot) {
      const id = parseRollId(entry.id);
      if (!id.ok) {
        return Promise.resolve(id);
      }
      snapshot.push({ id: id.value, version: entry.version });
    }

    const changes = [];
    for (const change of input.changes) {
      const id = parseRollId(change.id);
      if (!id.ok) {
        return Promise.resolve(id);
      }
      const roll = parseRollNumber(change.roll);
      if (!roll.ok) {
        return Promise.resolve(roll);
      }
      changes.push({ id: id.value, roll: roll.value });
    }

    return this.#rolls.saveRenumberedBatch(
      ctx,
      snapshot,
      input.unreadable,
      changes,
    );
  }
}
