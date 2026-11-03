import { parseShotDate } from '../../../domain/rolls/shot-date.ts';
import type { ArchiveContext } from '../../../domain/shared/archive-context.ts';
import type {
  ConcurrencyConflict,
  NotFound,
  ValidationFailed,
} from '../../../domain/shared/domain-error.ts';
import type { RollId } from '../../../domain/shared/ids.ts';
import { err, ok, type Result } from '../../../domain/shared/result.ts';
import type {
  RollRepository,
  VersionedRoll,
} from '../../ports/roll-repository.ts';
import { textOrNull } from './text-or-null.ts';

/**
 * Changes a roll's details: name, description and date shot. A detail left
 * out stays as it is; null or blank clears it. Saved only if the roll hasn't
 * changed since the caller read it at `expectedVersion`.
 */
export class UpdateRoll {
  readonly #rolls: RollRepository;

  constructor(rolls: RollRepository) {
    this.#rolls = rolls;
  }

  async execute(
    ctx: ArchiveContext,
    input: {
      readonly id: RollId;
      readonly expectedVersion: string;
      readonly name?: string | null | undefined;
      readonly description?: string | null | undefined;
      readonly shot?: string | null | undefined;
    },
  ): Promise<
    Result<VersionedRoll, NotFound | ConcurrencyConflict | ValidationFailed>
  > {
    const shot =
      input.shot === undefined || input.shot === null
        ? ok(input.shot)
        : parseShotDate(input.shot);
    if (!shot.ok) {
      return shot;
    }
    const current = await this.#rolls.get(ctx, input.id);
    if (current === undefined) {
      return err({ kind: 'not-found', entity: 'roll', id: input.id });
    }
    const roll = {
      ...current.roll,
      ...(input.name === undefined ? {} : { name: textOrNull(input.name) }),
      ...(input.description === undefined
        ? {}
        : { description: textOrNull(input.description) }),
      ...(shot.value === undefined ? {} : { shot: shot.value }),
    };
    const saved = await this.#rolls.save(ctx, roll, input.expectedVersion);
    return saved.ok ? ok({ roll, version: saved.value }) : saved;
  }
}
