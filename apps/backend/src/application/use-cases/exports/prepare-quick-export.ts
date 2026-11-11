import type { ArchiveContext } from '../../../domain/shared/archive-context.ts';
import type {
  NotFound,
  ValidationFailed,
} from '../../../domain/shared/domain-error.ts';
import type { FrameId, RollId } from '../../../domain/shared/ids.ts';
import { err, ok, type Result } from '../../../domain/shared/result.ts';
import type { ExportTickets } from '../../ports/export-tickets.ts';
import type { ExportRecipe } from '../../ports/image-renderer.ts';
import type { RollRepository } from '../../ports/roll-repository.ts';

function refused(message: string): ValidationFailed {
  return {
    kind: 'validation-failed',
    issues: [{ path: ['frame'], message }],
  };
}

/**
 * Checks a frame can be exported once (D95) and gives a single-use ticket to
 * download it with. A frame with no version has nothing to export, and a
 * hidden one is unhidden first (D99).
 */
export class PrepareQuickExport {
  readonly #rolls: RollRepository;
  readonly #tickets: ExportTickets;

  constructor(rolls: RollRepository, tickets: ExportTickets) {
    this.#rolls = rolls;
    this.#tickets = tickets;
  }

  async execute(
    ctx: ArchiveContext,
    input: {
      readonly rollId: RollId;
      readonly frameId: FrameId;
      readonly recipe: ExportRecipe;
    },
  ): Promise<Result<string, NotFound | ValidationFailed>> {
    const roll = (await this.#rolls.get(ctx, input.rollId))?.roll;
    if (roll === undefined) {
      return err({ kind: 'not-found', entity: 'roll', id: input.rollId });
    }
    const frame = roll.frames.find((f) => f.id === input.frameId);
    if (frame === undefined) {
      return err({ kind: 'not-found', entity: 'frame', id: input.frameId });
    }
    if (frame.hidden) {
      return err(refused('this frame is hidden; unhide it to export it'));
    }
    if (frame.versions.length === 0) {
      return err(refused('this frame has no scan to export'));
    }
    return ok(this.#tickets.issue(input));
  }
}
