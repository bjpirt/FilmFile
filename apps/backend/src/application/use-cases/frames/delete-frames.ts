import type { ArchiveContext } from '../../../domain/shared/archive-context.ts';
import type {
  ConcurrencyConflict,
  NotFound,
} from '../../../domain/shared/domain-error.ts';
import type { RollId } from '../../../domain/shared/ids.ts';
import { err, ok, type Result } from '../../../domain/shared/result.ts';
import type { Clock } from '../../ports/clock.ts';
import type { HoldingArea } from '../../ports/holding-area.ts';
import type { RollRepository } from '../../ports/roll-repository.ts';

/**
 * Deletes many frames of a roll together, as when frames are selected
 * (U38), if the roll hasn't changed since the caller read it at
 * `expectedVersion`. As for one frame (D12), nothing is lost: the roll is
 * saved without them in one save, then each frame's files and JSON go to
 * the holding area. Nothing is deleted if any frame isn't in the roll.
 */
export class DeleteFrames {
  readonly #rolls: RollRepository;
  readonly #holding: HoldingArea;
  readonly #clock: Clock;

  constructor(rolls: RollRepository, holding: HoldingArea, clock: Clock) {
    this.#rolls = rolls;
    this.#holding = holding;
    this.#clock = clock;
  }

  async execute(
    ctx: ArchiveContext,
    input: {
      readonly rollId: RollId;
      readonly frameIds: readonly string[];
      readonly expectedVersion: string;
    },
  ): Promise<
    Result<{ readonly version: string }, NotFound | ConcurrencyConflict>
  > {
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
    const saved = await this.#rolls.save(
      ctx,
      {
        ...current.roll,
        frames: current.roll.frames.filter((frame) => !chosen.has(frame.id)),
      },
      input.expectedVersion,
    );
    if (!saved.ok) {
      return saved;
    }
    // Once the roll no longer has them, their files can go.
    const at = this.#clock.now();
    for (const frame of current.roll.frames.filter((f) => chosen.has(f.id))) {
      await this.#holding.holdFrame(ctx, {
        rollId: current.roll.id,
        roll: current.roll.roll,
        frame,
        at,
      });
    }
    return ok({ version: saved.value });
  }
}
