import { nextRollNumber } from '../../../domain/rolls/next-roll-number.ts';
import {
  parseRollNumber,
  type RollNumber,
} from '../../../domain/rolls/roll-number.ts';
import { parseShotDate } from '../../../domain/rolls/shot-date.ts';
import type { Roll } from '../../../domain/rolls/roll.ts';
import type { ArchiveContext } from '../../../domain/shared/archive-context.ts';
import type {
  AlreadyExists,
  ValidationFailed,
} from '../../../domain/shared/domain-error.ts';
import { err, ok, type Result } from '../../../domain/shared/result.ts';
import type { Clock } from '../../ports/clock.ts';
import type { EquipmentRepository } from '../../ports/equipment-repository.ts';
import type { EventRepository } from '../../ports/event-repository.ts';
import type { IdGenerator } from '../../ports/id-generator.ts';
import type { RollRepository } from '../../ports/roll-repository.ts';
import { knownCamera } from './known-camera.ts';
import { knownEvent } from './known-event.ts';
import { knownFilmStock } from './known-film-stock.ts';
import { knownLens } from './known-lens.ts';
import { textOrNull } from './text-or-null.ts';

/** How many times a roll created with no number picks again when others take its number first. */
const maxAttempts = 50;

/**
 * Creates an empty roll. A roll number given is used; with none, the roll gets
 * the next free one of the year it was shot, or this year's (D67).
 */
export class CreateRoll {
  readonly #rolls: RollRepository;
  readonly #equipment: EquipmentRepository;
  readonly #events: EventRepository;
  readonly #ids: IdGenerator;
  readonly #clock: Clock;

  constructor(
    rolls: RollRepository,
    equipment: EquipmentRepository,
    events: EventRepository,
    ids: IdGenerator,
    clock: Clock,
  ) {
    this.#rolls = rolls;
    this.#equipment = equipment;
    this.#events = events;
    this.#ids = ids;
    this.#clock = clock;
  }

  async execute(
    ctx: ArchiveContext,
    input: {
      /** `YYYY-NNN`; the next free number is given when it's left out. */
      readonly roll?: string | undefined;
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
    const given =
      input.roll === undefined ? ok(undefined) : parseRollNumber(input.roll);
    if (!given.ok) {
      return given;
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
    const id = this.#ids.newRollId();
    const rollWith = (number: RollNumber): Roll => ({
      id,
      roll: number,
      name: textOrNull(input.name),
      notes: textOrNull(input.notes),
      shot: shot.value,
      event: event.value,
      camera: camera.value,
      film: film.value,
      lens: lens.value,
      frames: [],
    });
    if (given.value !== undefined) {
      const roll = rollWith(given.value);
      const created = await this.#rolls.create(ctx, roll);
      return created.ok ? ok(roll) : created;
    }
    return this.#createNumbered(ctx, input.shot, rollWith);
  }

  /**
   * Creates a roll with the next free number of the year it was shot, or this
   * year's. If another roll takes the number in between, picks again.
   */
  async #createNumbered(
    ctx: ArchiveContext,
    shot: string | undefined,
    rollWith: (number: RollNumber) => Roll,
  ): Promise<Result<Roll, ValidationFailed | AlreadyExists>> {
    const year =
      /^\d{4}/.exec(shot ?? '')?.[0] ?? String(this.#clock.now().getFullYear());
    let taken: Result<Roll, AlreadyExists> | undefined;
    // Rolls created at the same moment each take a turn at winning a number.
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const listing = await this.#rolls.list(ctx);
      const number = nextRollNumber(year, [
        ...listing.rolls.map((r) => r.roll),
        ...listing.unreadable.map((u) => u.folder),
      ]);
      if (number === undefined) {
        return err({
          kind: 'validation-failed',
          issues: [
            { path: ['roll'], message: `no roll numbers are left for ${year}` },
          ],
        });
      }
      const roll = rollWith(number);
      const created = await this.#rolls.create(ctx, roll);
      if (created.ok) {
        return ok(roll);
      }
      taken = created;
    }
    return taken ?? err({ kind: 'already-exists', entity: 'roll', id: year });
  }
}
