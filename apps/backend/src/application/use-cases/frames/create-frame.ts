import { newIdWithUniqueFolder } from '../../../domain/rolls/folder-names.ts';
import { parseFrameNumber } from '../../../domain/rolls/frame-number.ts';
import type { Frame } from '../../../domain/rolls/roll.ts';
import type { ArchiveContext } from '../../../domain/shared/archive-context.ts';
import type {
  NotFound,
  ValidationFailed,
} from '../../../domain/shared/domain-error.ts';
import type { RollId } from '../../../domain/shared/ids.ts';
import { ok, type Result } from '../../../domain/shared/result.ts';
import type { IdGenerator } from '../../ports/id-generator.ts';
import type { RollRepository } from '../../ports/roll-repository.ts';

/** Adds a frame with no versions to the end of a roll. */
export class CreateFrame {
  readonly #rolls: RollRepository;
  readonly #ids: IdGenerator;

  constructor(rolls: RollRepository, ids: IdGenerator) {
    this.#rolls = rolls;
    this.#ids = ids;
  }

  async execute(
    ctx: ArchiveContext,
    input: { readonly rollId: RollId; readonly number?: string | undefined },
  ): Promise<Result<Frame, NotFound | ValidationFailed>> {
    const number =
      input.number === undefined ? ok(null) : parseFrameNumber(input.number);
    if (!number.ok) {
      return number;
    }
    return this.#rolls.change(ctx, input.rollId, (roll) => {
      const frame: Frame = {
        id: newIdWithUniqueFolder(
          roll.frames.map((f) => f.id),
          () => this.#ids.newFrameId(),
        ),
        number: number.value,
        versions: [],
      };
      return Promise.resolve(
        ok({
          roll: { ...roll, frames: [...roll.frames, frame] },
          value: frame,
        }),
      );
    });
  }
}
