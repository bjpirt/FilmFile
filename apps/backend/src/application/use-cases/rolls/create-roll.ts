import { parseRollNumber } from '../../../domain/rolls/roll-number.ts';
import { parseShotDate } from '../../../domain/rolls/shot-date.ts';
import type { Roll } from '../../../domain/rolls/roll.ts';
import type { ArchiveContext } from '../../../domain/shared/archive-context.ts';
import type {
  AlreadyExists,
  ValidationFailed,
} from '../../../domain/shared/domain-error.ts';
import { ok, type Result } from '../../../domain/shared/result.ts';
import type { IdGenerator } from '../../ports/id-generator.ts';
import type { RollRepository } from '../../ports/roll-repository.ts';
import { textOrNull } from './text-or-null.ts';

/** Creates an empty roll. The roll number is always given: it's never invented (D8). */
export class CreateRoll {
  readonly #rolls: RollRepository;
  readonly #ids: IdGenerator;

  constructor(rolls: RollRepository, ids: IdGenerator) {
    this.#rolls = rolls;
    this.#ids = ids;
  }

  async execute(
    ctx: ArchiveContext,
    input: {
      readonly roll: string;
      readonly name?: string | undefined;
      readonly description?: string | undefined;
      readonly shot?: string | undefined;
    },
  ): Promise<Result<Roll, ValidationFailed | AlreadyExists>> {
    const rollNumber = parseRollNumber(input.roll);
    if (!rollNumber.ok) {
      return rollNumber;
    }
    const shot =
      input.shot === undefined ? ok(null) : parseShotDate(input.shot);
    if (!shot.ok) {
      return shot;
    }
    const roll: Roll = {
      id: this.#ids.newRollId(),
      roll: rollNumber.value,
      name: textOrNull(input.name),
      description: textOrNull(input.description),
      shot: shot.value,
      frames: [],
    };
    const created = await this.#rolls.create(ctx, roll);
    return created.ok ? ok(roll) : created;
  }
}
