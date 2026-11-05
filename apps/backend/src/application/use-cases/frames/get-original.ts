import { findVersion } from '../../../domain/rolls/find-version.ts';
import type { ArchiveContext } from '../../../domain/shared/archive-context.ts';
import type { NotFound } from '../../../domain/shared/domain-error.ts';
import type { FrameId, RollId, VersionId } from '../../../domain/shared/ids.ts';
import { err, ok, type Result } from '../../../domain/shared/result.ts';
import type { BlobStore } from '../../ports/blob-store.ts';
import type { RollRepository } from '../../ports/roll-repository.ts';

/** A version's file, exactly as it was added. */
export class GetOriginal {
  readonly #rolls: RollRepository;
  readonly #blobs: BlobStore;

  constructor(rolls: RollRepository, blobs: BlobStore) {
    this.#rolls = rolls;
    this.#blobs = blobs;
  }

  async execute(
    ctx: ArchiveContext,
    input: {
      readonly rollId: RollId;
      readonly frameId: FrameId;
      readonly versionId: VersionId;
    },
  ): Promise<Result<Uint8Array, NotFound>> {
    const roll = (await this.#rolls.get(ctx, input.rollId))?.roll;
    const version = roll && findVersion(roll, input.frameId, input.versionId);
    if (roll === undefined || version === undefined) {
      return err({ kind: 'not-found', entity: 'version', id: input.versionId });
    }
    return ok(await this.#blobs.get(ctx, roll.id, version.file));
  }
}
