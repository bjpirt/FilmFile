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
import type { EventRepository } from '../../ports/event-repository.ts';
import type { IdGenerator } from '../../ports/id-generator.ts';
import type { RollRepository } from '../../ports/roll-repository.ts';
import { knownCamera } from './known-camera.ts';
import { knownEvent } from './known-event.ts';
import { knownFilmStock } from './known-film-stock.ts';
import { knownLens } from './known-lens.ts';
import { textOrNull } from './text-or-null.ts';

/** Creates an empty roll. The roll number is always given: it's never invented (D8). */
export class CreateRoll {
  readonly #rolls: RollRepository;
  readonly #equipment: EquipmentRepository;
  readonly #events: EventRepository;
  readonly #ids: IdGenerator;

  constructor(
    rolls: RollRepository,
    equipment: EquipmentRepository,
    events: EventRepository,
    ids: IdGenerator,
  ) {
    this.#rolls = rolls;
    this.#equipment = equipment;
    this.#events = events;
    this.#ids = ids;
  }

  async execute(
    ctx: ArchiveContext,
    input: {
      readonly roll: string;
      readonly name?: string | undefined;
      readonly notes?: string | undefined;
      readonly shot?: string | undefined;
      /** The event's slug. */
      readonly event?: string | undefined;
      /** The camera's slug. */
      readonly camera?: string | undefined;
      /** The film stock's slug. */
      readonly film?: string | undefined;
      /** The lens's slug. */
      readonly lens?: string | undefined;
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
    const event =
      input.event === undefined
        ? ok(null)
        : await knownEvent(this.#events, ctx, input.event);
    if (!event.ok) {
      return event;
    }
    const camera =
      input.camera === undefined
        ? ok(null)
        : await knownCamera(this.#equipment, ctx, input.camera);
    if (!camera.ok) {
      return camera;
    }
    const film =
      input.film === undefined
        ? ok(null)
        : await knownFilmStock(this.#equipment, ctx, input.film);
    if (!film.ok) {
      return film;
    }
    const lens =
      input.lens === undefined
        ? ok(null)
        : await knownLens(this.#equipment, ctx, input.lens);
    if (!lens.ok) {
      return lens;
    }
    const roll: Roll = {
      id: this.#ids.newRollId(),
      roll: rollNumber.value,
      name: textOrNull(input.name),
      notes: textOrNull(input.notes),
      shot: shot.value,
      event: event.value,
      camera: camera.value,
      film: film.value,
      lens: lens.value,
      frames: [],
    };
    const created = await this.#rolls.create(ctx, roll);
    return created.ok ? ok(roll) : created;
  }
}
