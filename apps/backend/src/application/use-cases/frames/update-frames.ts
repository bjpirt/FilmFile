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
import { knownEvent } from '../rolls/known-event.ts';
import { knownLens } from '../rolls/known-lens.ts';

/**
 * Gives many frames the same camera, lens or events of their
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
      readonly lens?: string | null | undefined;
      /** The event to set on each frame, or null to use each roll's. */
      readonly event?: string | null | undefined;
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
    const lens =
      input.lens === undefined || input.lens === null
        ? ok(input.lens)
        : await knownLens(this.#equipment, ctx, input.lens);
    if (!lens.ok) {
      return lens;
    }
    const event =
      input.event === undefined || input.event === null
        ? ok(input.event)
        : await knownEvent(this.#events, ctx, input.event);
    if (!event.ok) {
      return event;
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
              ...(lens.value === undefined ? {} : { lens: lens.value }),
              ...(event.value === undefined ? {} : { event: event.value }),
            }
          : frame,
      ),
    };
    // One save for every frame, against the version the caller read.
    const saved = await this.#rolls.save(ctx, roll, input.expectedVersion);
    return saved.ok ? ok({ roll, version: saved.value }) : saved;
  }
}
