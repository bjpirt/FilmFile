import { parseRollNumber } from '../../../domain/rolls/roll-number.ts';
import { parseShotDate } from '../../../domain/rolls/shot-date.ts';
import type { ArchiveContext } from '../../../domain/shared/archive-context.ts';
import type {
  ConcurrencyConflict,
  NotFound,
  ValidationFailed,
} from '../../../domain/shared/domain-error.ts';
import type { RollId } from '../../../domain/shared/ids.ts';
import { err, ok, type Result } from '../../../domain/shared/result.ts';
import type { EquipmentRepository } from '../../ports/equipment-repository.ts';
import type { EventRepository } from '../../ports/event-repository.ts';
import type {
  RollRepository,
  VersionedRoll,
} from '../../ports/roll-repository.ts';
import { knownCamera } from './known-camera.ts';
import { knownEvent } from './known-event.ts';
import { knownFilmStock } from './known-film-stock.ts';
import { knownLens } from './known-lens.ts';
import { textOrNull } from './text-or-null.ts';

/**
 * Changes a roll's details: its roll number, name, notes, date shot, event,
 * camera, film stock and lens. A detail left out stays as it is; null or
 * blank clears it. A number another roll has is refused as a problem with
 * the number (D70). Saved only if the roll hasn't changed since the caller
 * read it at `expectedVersion`.
 */
export class UpdateRoll {
  readonly #rolls: RollRepository;
  readonly #equipment: EquipmentRepository;
  readonly #events: EventRepository;

  constructor(
    rolls: RollRepository,
    equipment: EquipmentRepository,
    events: EventRepository,
  ) {
    this.#rolls = rolls;
    this.#equipment = equipment;
    this.#events = events;
  }

  async execute(
    ctx: ArchiveContext,
    input: {
      readonly id: RollId;
      readonly expectedVersion: string;
      /** The roll's number, `YYYY-NNN`; its year needn't be the year shot. */
      readonly roll?: string | undefined;
      readonly filed?: boolean | undefined;
      readonly name?: string | null | undefined;
      readonly notes?: string | null | undefined;
      readonly shot?: string | null | undefined;
      /** The event's slug. */
      readonly event?: string | null | undefined;
      /** The camera's slug. */
      readonly camera?: string | null | undefined;
      /** The film stock's slug. */
      readonly film?: string | null | undefined;
      /** The lens's slug. */
      readonly lens?: string | null | undefined;
    },
  ): Promise<
    Result<VersionedRoll, NotFound | ConcurrencyConflict | ValidationFailed>
  > {
    const number =
      input.roll === undefined ? ok(undefined) : parseRollNumber(input.roll);
    if (!number.ok) {
      return number;
    }
    const shot =
      input.shot === undefined || input.shot === null
        ? ok(input.shot)
        : parseShotDate(input.shot);
    if (!shot.ok) {
      return shot;
    }
    const event =
      input.event === undefined || input.event === null
        ? ok(input.event)
        : await knownEvent(this.#events, ctx, input.event);
    if (!event.ok) {
      return event;
    }
    const camera =
      input.camera === undefined || input.camera === null
        ? ok(input.camera)
        : await knownCamera(this.#equipment, ctx, input.camera);
    if (!camera.ok) {
      return camera;
    }
    const film =
      input.film === undefined || input.film === null
        ? ok(input.film)
        : await knownFilmStock(this.#equipment, ctx, input.film);
    if (!film.ok) {
      return film;
    }
    const lens =
      input.lens === undefined || input.lens === null
        ? ok(input.lens)
        : await knownLens(this.#equipment, ctx, input.lens);
    if (!lens.ok) {
      return lens;
    }
    const current = await this.#rolls.get(ctx, input.id);
    if (current === undefined) {
      return err({ kind: 'not-found', entity: 'roll', id: input.id });
    }
    const roll = {
      ...current.roll,
      ...(number.value === undefined ? {} : { roll: number.value }),
      ...(input.filed === undefined ? {} : { filed: input.filed }),
      ...(input.name === undefined ? {} : { name: textOrNull(input.name) }),
      ...(input.notes === undefined ? {} : { notes: textOrNull(input.notes) }),
      ...(shot.value === undefined ? {} : { shot: shot.value }),
      ...(event.value === undefined ? {} : { event: event.value }),
      ...(camera.value === undefined ? {} : { camera: camera.value }),
      ...(film.value === undefined ? {} : { film: film.value }),
      ...(lens.value === undefined ? {} : { lens: lens.value }),
    };
    const saved = await this.#rolls.saveRenumbered(
      ctx,
      roll,
      input.expectedVersion,
    );
    if (saved.ok) {
      return ok({ roll, version: saved.value });
    }
    const failure = saved.error;
    return failure.kind === 'already-exists'
      ? err({
          kind: 'validation-failed',
          issues: [
            { path: ['roll'], message: 'is already used by another roll' },
          ],
        })
      : err(failure);
  }
}
