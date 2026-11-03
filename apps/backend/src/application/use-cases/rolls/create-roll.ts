import { parseRollNumber } from '../../../domain/rolls/roll-number.ts';
import { parseShotDate } from '../../../domain/rolls/shot-date.ts';
import type { Roll } from '../../../domain/rolls/roll.ts';
import type { ArchiveContext } from '../../../domain/shared/archive-context.ts';
import type {
  AlreadyExists,
  ValidationFailed,
} from '../../../domain/shared/domain-error.ts';
import { ok, type Result } from '../../../domain/shared/result.ts';
import type { EquipmentRepository } from '../../ports/equipment-repository.ts';
import type { IdGenerator } from '../../ports/id-generator.ts';
import type { RollRepository } from '../../ports/roll-repository.ts';
import { knownCamera } from './known-camera.ts';
import { textOrNull } from './text-or-null.ts';

/** Creates an empty roll. The roll number is always given: it's never invented (D8). */
export class CreateRoll {
  readonly #rolls: RollRepository;
  readonly #equipment: EquipmentRepository;
  readonly #ids: IdGenerator;

  constructor(
    rolls: RollRepository,
    equipment: EquipmentRepository,
    ids: IdGenerator,
  ) {
    this.#rolls = rolls;
    this.#equipment = equipment;
    this.#ids = ids;
  }

  async execute(
    ctx: ArchiveContext,
    input: {
      readonly roll: string;
      readonly name?: string | undefined;
      readonly description?: string | undefined;
      readonly shot?: string | undefined;
      /** The camera's slug. */
      readonly camera?: string | undefined;
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
    const camera =
      input.camera === undefined
        ? ok(null)
        : await knownCamera(this.#equipment, ctx, input.camera);
    if (!camera.ok) {
      return camera;
    }
    const roll: Roll = {
      id: this.#ids.newRollId(),
      roll: rollNumber.value,
      name: textOrNull(input.name),
      description: textOrNull(input.description),
      shot: shot.value,
      camera: camera.value,
      frames: [],
    };
    const created = await this.#rolls.create(ctx, roll);
    return created.ok ? ok(roll) : created;
  }
}
