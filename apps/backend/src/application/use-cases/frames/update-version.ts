import { isQuarterTurn } from '../../../domain/rolls/quarter-turn.ts';
import { findVersion } from '../../../domain/rolls/find-version.ts';
import { isVersionKind } from '../../../domain/rolls/version-kind.ts';
import type { Version } from '../../../domain/rolls/roll.ts';
import type { ArchiveContext } from '../../../domain/shared/archive-context.ts';
import type {
  ConcurrencyConflict,
  NotFound,
  ValidationFailed,
} from '../../../domain/shared/domain-error.ts';
import type { FrameId, RollId, VersionId } from '../../../domain/shared/ids.ts';
import { err, ok, type Result } from '../../../domain/shared/result.ts';
import type { RollRepository } from '../../ports/roll-repository.ts';

/**
 * Turns a version, by quarter turns clockwise, as it's shown (D41), or
 * changes what kind it is (D48); its file is never changed. A detail left
 * out stays as it is. Saved only if the roll hasn't changed since the caller
 * read it at `expectedVersion`.
 */
export class UpdateVersion {
  readonly #rolls: RollRepository;

  constructor(rolls: RollRepository) {
    this.#rolls = rolls;
  }

  async execute(
    ctx: ArchiveContext,
    input: {
      readonly rollId: RollId;
      readonly frameId: FrameId;
      readonly versionId: VersionId;
      readonly expectedVersion: string;
      /** Degrees clockwise: 0, 90, 180 or 270. */
      readonly rotate?: number | undefined;
      /** scan, raw-scan or final. */
      readonly kind?: string | undefined;
    },
  ): Promise<
    Result<
      { readonly updated: Version; readonly version: string },
      NotFound | ConcurrencyConflict | ValidationFailed
    >
  > {
    const { rotate, kind } = input;
    if (rotate !== undefined && !isQuarterTurn(rotate)) {
      return err({
        kind: 'validation-failed',
        issues: [{ path: ['rotate'], message: 'must be 0, 90, 180 or 270' }],
      });
    }
    if (kind !== undefined && !isVersionKind(kind)) {
      return err({
        kind: 'validation-failed',
        issues: [
          { path: ['kind'], message: 'must be scan, raw-scan or final' },
        ],
      });
    }
    const current = await this.#rolls.get(ctx, input.rollId);
    const version =
      current && findVersion(current.roll, input.frameId, input.versionId);
    if (current === undefined || version === undefined) {
      return err({ kind: 'not-found', entity: 'version', id: input.versionId });
    }

    const updated: Version = {
      ...version,
      ...(rotate === undefined ? {} : { rotate }),
      ...(kind === undefined ? {} : { kind }),
    };
    const saved = await this.#rolls.save(
      ctx,
      {
        ...current.roll,
        frames: current.roll.frames.map((frame) => ({
          ...frame,
          versions: frame.versions.map((v) =>
            v.id === version.id ? updated : v,
          ),
        })),
      },
      input.expectedVersion,
    );
    return saved.ok ? ok({ updated, version: saved.value }) : saved;
  }
}
