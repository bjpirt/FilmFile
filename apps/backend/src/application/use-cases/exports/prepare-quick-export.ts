import type { ArchiveContext } from '../../../domain/shared/archive-context.ts';
import type {
  NotFound,
  ValidationFailed,
} from '../../../domain/shared/domain-error.ts';
import { err, ok, type Result } from '../../../domain/shared/result.ts';
import type { QuickExport } from '../../ports/export-tickets.ts';
import type { ExportTickets } from '../../ports/export-tickets.ts';
import type { RollRepository } from '../../ports/roll-repository.ts';
import { unknownPlaceholders } from './export-names.ts';

function refused(path: string, message: string): ValidationFailed {
  return {
    kind: 'validation-failed',
    issues: [{ path: [path], message }],
  };
}

/**
 * Checks what's to be exported once (D95) and gives a single-use ticket to
 * download it with. Every frame must be there. A JPEG is one frame that has
 * a scan and isn't hidden (D99); in a zip, a frame that can't be made is left
 * out and listed in `skipped.txt` instead.
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
    input: QuickExport,
  ): Promise<Result<string, NotFound | ValidationFailed>> {
    const unknown = unknownPlaceholders(input.naming.pattern);
    if (unknown.length > 0) {
      return err(
        refused(
          'fileNames',
          `unknown ${unknown.map((name) => `{${name}}`).join(', ')}; use {roll}, {frame}, {title}, {year} or {original}`,
        ),
      );
    }
    if (input.output === 'jpeg' && input.frames.length !== 1) {
      return err(refused('frames', 'a JPEG is of one frame'));
    }
    for (const { rollId, frameId } of input.frames) {
      const roll = (await this.#rolls.get(ctx, rollId))?.roll;
      if (roll === undefined) {
        return err({ kind: 'not-found', entity: 'roll', id: rollId });
      }
      const frame = roll.frames.find((f) => f.id === frameId);
      if (frame === undefined) {
        return err({ kind: 'not-found', entity: 'frame', id: frameId });
      }
      if (input.output === 'jpeg' && frame.hidden) {
        return err(
          refused('frame', 'this frame is hidden; unhide it to export it'),
        );
      }
      if (input.output === 'jpeg' && frame.versions.length === 0) {
        return err(refused('frame', 'this frame has no scan to export'));
      }
    }
    return ok(this.#tickets.issue(input));
  }
}
