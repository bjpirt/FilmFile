import type { ArchiveContext } from '../../../domain/shared/archive-context.ts';
import type {
  ConcurrencyConflict,
  NotFound,
} from '../../../domain/shared/domain-error.ts';
import type { FrameId, RollId } from '../../../domain/shared/ids.ts';
import { err, ok, type Result } from '../../../domain/shared/result.ts';
import type { Clock } from '../../ports/clock.ts';
import type { HoldingArea } from '../../ports/holding-area.ts';
import type { RollRepository } from '../../ports/roll-repository.ts';

/**
 * Deletes a frame, if the roll hasn't changed since the caller read it at
 * `expectedVersion`. Nothing is lost: the roll is saved without the frame
 * first, then the frame's files and JSON go to the holding area (D12).
 */
export class DeleteFrame {
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
      readonly frameId: FrameId;
      readonly expectedVersion: string;
    },
  ): Promise<
    Result<{ readonly version: string }, NotFound | ConcurrencyConflict>
  > {
    const current = await this.#rolls.get(ctx, input.rollId);
    if (current === undefined) {
      return err({ kind: 'not-found', entity: 'roll', id: input.rollId });
    }
    const frame = current.roll.frames.find((f) => f.id === input.frameId);
    if (frame === undefined) {
      return err({ kind: 'not-found', entity: 'frame', id: input.frameId });
    }
    const saved = await this.#rolls.save(
      ctx,
      {
        ...current.roll,
        frames: current.roll.frames.filter((f) => f.id !== frame.id),
      },
      input.expectedVersion,
    );
    if (!saved.ok) {
      return saved;
    }
    // Once the roll no longer has the frame, its files can go.
    await this.#holding.holdFrame(ctx, {
      rollId: current.roll.id,
      roll: current.roll.roll,
      frame,
      at: this.#clock.now(),
    });
    return ok({ version: saved.value });
  }
}
