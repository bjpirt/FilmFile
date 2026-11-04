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
import { knownCamera } from '../rolls/known-camera.ts';
import { knownFilmStock } from '../rolls/known-film-stock.ts';
import { knownLens } from '../rolls/known-lens.ts';
import { knownEvents } from './known-events.ts';

/**
 * Gives many frames the same camera, film stock, lens or events of their
 * own (U15), in one save of their roll, as when frames are selected and set
 * together (U16). A detail left out stays as each frame has it; null goes
 * back to the roll's. Nothing is saved if any detail isn't in the archive or
 * any frame isn't in the roll, or if the roll changed since the caller read
 * it at `expectedVersion`.
 */
export class UpdateFrames {
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
      readonly rollId: RollId;
      readonly expectedVersion: string;
      readonly frameIds: readonly string[];
      /** Slugs of equipment in the archive. */
      readonly camera?: string | null | undefined;
      readonly film?: string | null | undefined;
      readonly lens?: string | null | undefined;
      /** Slugs of events in the archive. */
      readonly events?: readonly string[] | null | undefined;
    },
  ): Promise<
    Result<VersionedRoll, NotFound | ConcurrencyConflict | ValidationFailed>
  > {
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
    const events =
      input.events === undefined || input.events === null
        ? ok(input.events)
        : await knownEvents(this.#events, ctx, input.events);
    if (!events.ok) {
      return events;
    }
    const current = await this.#rolls.get(ctx, input.rollId);
    if (current === undefined) {
      return err({ kind: 'not-found', entity: 'roll', id: input.rollId });
    }
    const absent = input.frameIds.find(
      (id) => !current.roll.frames.some((frame) => frame.id === id),
    );
    if (absent !== undefined) {
      return err({ kind: 'not-found', entity: 'frame', id: absent });
    }

    const chosen = new Set(input.frameIds);
    const roll = {
      ...current.roll,
      frames: current.roll.frames.map((frame) =>
        chosen.has(frame.id)
          ? {
              ...frame,
              ...(camera.value === undefined ? {} : { camera: camera.value }),
              ...(film.value === undefined ? {} : { film: film.value }),
              ...(lens.value === undefined ? {} : { lens: lens.value }),
              ...(events.value === undefined ? {} : { events: events.value }),
            }
          : frame,
      ),
    };
    // One save for every frame, against the version the caller read.
    const saved = await this.#rolls.save(ctx, roll, input.expectedVersion);
    return saved.ok ? ok({ roll, version: saved.value }) : saved;
  }
}
