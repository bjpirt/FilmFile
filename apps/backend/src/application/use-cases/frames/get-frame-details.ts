import type { ResolvedDetails } from '../../../domain/details/details.ts';
import { archiveLayer, rollLayer } from '../../../domain/details/layers.ts';
import { resolveDetails } from '../../../domain/details/resolve-details.ts';
import type { ArchiveContext } from '../../../domain/shared/archive-context.ts';
import type { NotFound } from '../../../domain/shared/domain-error.ts';
import type { FrameId, RollId } from '../../../domain/shared/ids.ts';
import { err, ok, type Result } from '../../../domain/shared/result.ts';
import type { ArchiveRepository } from '../../ports/archive-repository.ts';
import type { RollRepository } from '../../ports/roll-repository.ts';

/**
 * The details a frame ends up with, resolved from the archive and its roll
 * (design section 6), each with where it came from. Frames add their own
 * layer with U15.
 */
export class GetFrameDetails {
  readonly #rolls: RollRepository;
  readonly #archives: ArchiveRepository;

  constructor(rolls: RollRepository, archives: ArchiveRepository) {
    this.#rolls = rolls;
    this.#archives = archives;
  }

  async execute(
    ctx: ArchiveContext,
    input: { readonly rollId: RollId; readonly frameId: FrameId },
  ): Promise<Result<ResolvedDetails, NotFound>> {
    const roll = (await this.#rolls.get(ctx, input.rollId))?.roll;
    if (roll === undefined) {
      return err({ kind: 'not-found', entity: 'roll', id: input.rollId });
    }
    if (!roll.frames.some((frame) => frame.id === input.frameId)) {
      return err({ kind: 'not-found', entity: 'frame', id: input.frameId });
    }
    const archive = (await this.#archives.get(ctx))?.archive;
    return ok(
      resolveDetails([
        ...(archive === undefined ? [] : [archiveLayer(archive)]),
        rollLayer(roll),
      ]),
    );
  }
}
