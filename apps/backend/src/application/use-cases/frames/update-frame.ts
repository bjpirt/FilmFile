import { parseFrameNumber } from '../../../domain/rolls/frame-number.ts';
import { parseRating } from '../../../domain/rolls/rating.ts';
import type { Frame } from '../../../domain/rolls/roll.ts';
import type { ArchiveContext } from '../../../domain/shared/archive-context.ts';
import type {
  ConcurrencyConflict,
  NotFound,
  ValidationFailed,
} from '../../../domain/shared/domain-error.ts';
import type { FrameId, RollId } from '../../../domain/shared/ids.ts';
import { err, ok, type Result } from '../../../domain/shared/result.ts';
import type { RollRepository } from '../../ports/roll-repository.ts';
import { textOrNull } from '../rolls/text-or-null.ts';

/**
 * Changes a frame's number, the version shown for it (D15), or how it's
 * described: its title, rating and notes. Saved only if the roll hasn't
 * changed since the caller read it at `expectedVersion`. A detail left out
 * stays as it is; null, or blank text, clears it.
 */
export class UpdateFrame {
  readonly #rolls: RollRepository;

  constructor(rolls: RollRepository) {
    this.#rolls = rolls;
  }

  async execute(
    ctx: ArchiveContext,
    input: {
      readonly rollId: RollId;
      readonly frameId: FrameId;
      readonly expectedVersion: string;
      readonly number?: string | null | undefined;
      /** The ID of one of the frame's own versions. */
      readonly defaultVersion?: string | null | undefined;
      readonly title?: string | null | undefined;
      /** One to five stars (D39). */
      readonly rating?: number | null | undefined;
      readonly notes?: string | null | undefined;
    },
  ): Promise<
    Result<
      { readonly frame: Frame; readonly version: string },
      NotFound | ConcurrencyConflict | ValidationFailed
    >
  > {
    const number =
      input.number === undefined || input.number === null
        ? ok(input.number)
        : parseFrameNumber(input.number);
    if (!number.ok) {
      return number;
    }
    const rating =
      input.rating === undefined || input.rating === null
        ? ok(input.rating)
        : parseRating(input.rating);
    if (!rating.ok) {
      return rating;
    }
    const current = await this.#rolls.get(ctx, input.rollId);
    if (current === undefined) {
      return err({ kind: 'not-found', entity: 'roll', id: input.rollId });
    }
    const frame = current.roll.frames.find((f) => f.id === input.frameId);
    if (frame === undefined) {
      return err({ kind: 'not-found', entity: 'frame', id: input.frameId });
    }
    const shown =
      input.defaultVersion === undefined || input.defaultVersion === null
        ? input.defaultVersion
        : frame.versions.find((v) => v.id === input.defaultVersion)?.id;
    if (shown === undefined && input.defaultVersion !== undefined) {
      return err({
        kind: 'validation-failed',
        issues: [
          {
            path: ['defaultVersion'],
            message: 'must be one of the frame’s versions',
          },
        ],
      });
    }

    const updated: Frame = {
      ...frame,
      ...(number.value === undefined ? {} : { number: number.value }),
      ...(shown === undefined ? {} : { defaultVersion: shown }),
      ...(input.title === undefined ? {} : { title: textOrNull(input.title) }),
      ...(rating.value === undefined ? {} : { rating: rating.value }),
      ...(input.notes === undefined ? {} : { notes: textOrNull(input.notes) }),
    };
    // Saved against the version the caller read, so a change made since is never overwritten.
    const saved = await this.#rolls.save(
      ctx,
      {
        ...current.roll,
        frames: current.roll.frames.map((f) =>
          f.id === frame.id ? updated : f,
        ),
      },
      input.expectedVersion,
    );
    return saved.ok ? ok({ frame: updated, version: saved.value }) : saved;
  }
}
