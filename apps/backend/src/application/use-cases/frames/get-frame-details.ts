import type { ResolvedDetails } from '../../../domain/details/details.ts';
import {
  archiveLayer,
  frameLayer,
  rollLayer,
} from '../../../domain/details/layers.ts';
import { resolveDetails } from '../../../domain/details/resolve-details.ts';
import type { ArchiveContext } from '../../../domain/shared/archive-context.ts';
import type { NotFound } from '../../../domain/shared/domain-error.ts';
import type { FrameId, RollId } from '../../../domain/shared/ids.ts';
import { err, ok, type Result } from '../../../domain/shared/result.ts';
import type { SettingsRepository } from '../../ports/settings-repository.ts';
import type { RollRepository } from '../../ports/roll-repository.ts';

/**
 * The details a frame ends up with, resolved from the archive, its roll and
 * its own (design section 6), each with where it came from.
 */
export class GetFrameDetails {
  readonly #rolls: RollRepository;
  readonly #settings: SettingsRepository;

  constructor(rolls: RollRepository, settings: SettingsRepository) {
    this.#rolls = rolls;
    this.#settings = settings;
  }

  async execute(
    ctx: ArchiveContext,
    input: { readonly rollId: RollId; readonly frameId: FrameId },
  ): Promise<Result<ResolvedDetails, NotFound>> {
    const roll = (await this.#rolls.get(ctx, input.rollId))?.roll;
    if (roll === undefined) {
      return err({ kind: 'not-found', entity: 'roll', id: input.rollId });
    }
    const frame = roll.frames.find((f) => f.id === input.frameId);
    if (frame === undefined) {
      return err({ kind: 'not-found', entity: 'frame', id: input.frameId });
    }
    const settings = (await this.#settings.get(ctx))?.settings;
    return ok(
      resolveDetails([
        ...(settings === undefined ? [] : [archiveLayer(settings)]),
        rollLayer(roll),
        frameLayer(frame),
      ]),
    );
  }
}
