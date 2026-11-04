import type { ArchiveContext } from '../../../domain/shared/archive-context.ts';
import type {
  ConcurrencyConflict,
  NotFound,
  ValidationFailed,
} from '../../../domain/shared/domain-error.ts';
import type { FrameId, RollId, VersionId } from '../../../domain/shared/ids.ts';
import { err, ok, type Result } from '../../../domain/shared/result.ts';
import type { Clock } from '../../ports/clock.ts';
import type { HoldingArea } from '../../ports/holding-area.ts';
import type { RollRepository } from '../../ports/roll-repository.ts';

/**
 * Deletes one version of a frame (U28b), if the roll hasn't changed since
 * the caller read it at `expectedVersion`. Nothing is lost: the roll is
 * saved without it first, then its files and JSON go to the holding area
 * (D12). A frame's only version can't be deleted: the frame is, instead.
 * If it was the version chosen to show, the frame's first is shown again.
 */
export class DeleteVersion {
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
      readonly versionId: VersionId;
      readonly expectedVersion: string;
    },
  ): Promise<
    Result<
      { readonly version: string },
      NotFound | ConcurrencyConflict | ValidationFailed
    >
  > {
    const current = await this.#rolls.get(ctx, input.rollId);
    if (current === undefined) {
      return err({ kind: 'not-found', entity: 'roll', id: input.rollId });
    }
    const frame = current.roll.frames.find((f) => f.id === input.frameId);
    if (frame === undefined) {
      return err({ kind: 'not-found', entity: 'frame', id: input.frameId });
    }
    const version = frame.versions.find((v) => v.id === input.versionId);
    if (version === undefined) {
      return err({ kind: 'not-found', entity: 'version', id: input.versionId });
    }
    if (frame.versions.length === 1) {
      return err({
        kind: 'validation-failed',
        issues: [
          {
            path: ['versionId'],
            message: 'is the frame’s only version; delete the frame instead',
          },
        ],
      });
    }
    const saved = await this.#rolls.save(
      ctx,
      {
        ...current.roll,
        frames: current.roll.frames.map((f) =>
          f.id === frame.id
            ? {
                ...f,
                versions: f.versions.filter((v) => v.id !== version.id),
                defaultVersion:
                  f.defaultVersion === version.id ? null : f.defaultVersion,
              }
            : f,
        ),
      },
      input.expectedVersion,
    );
    if (!saved.ok) {
      return saved;
    }
    // Once the frame no longer has it, its files can go.
    await this.#holding.holdVersion(ctx, {
      rollId: current.roll.id,
      roll: current.roll.roll,
      frameId: frame.id,
      version,
      at: this.#clock.now(),
    });
    return ok({ version: saved.value });
  }
}
