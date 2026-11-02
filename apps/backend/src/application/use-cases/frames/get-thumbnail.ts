import { findVersion } from '../../../domain/rolls/find-version.ts';
import type { ThumbnailSize } from '../../../domain/rolls/thumbnail-size.ts';
import type { ArchiveContext } from '../../../domain/shared/archive-context.ts';
import type { NotFound } from '../../../domain/shared/domain-error.ts';
import type { FrameId, RollId, VersionId } from '../../../domain/shared/ids.ts';
import { err, ok, type Result } from '../../../domain/shared/result.ts';
import type { BlobStore } from '../../ports/blob-store.ts';
import type { PreviewProvider } from '../../ports/preview-provider.ts';
import type { RollRepository } from '../../ports/roll-repository.ts';

/** A thumbnail of a version, made from its file the first time it's asked for. */
export class GetThumbnail {
  readonly #rolls: RollRepository;
  readonly #blobs: BlobStore;
  readonly #previews: PreviewProvider;

  constructor(
    rolls: RollRepository,
    blobs: BlobStore,
    previews: PreviewProvider,
  ) {
    this.#rolls = rolls;
    this.#blobs = blobs;
    this.#previews = previews;
  }

  async execute(
    ctx: ArchiveContext,
    input: {
      readonly rollId: RollId;
      readonly frameId: FrameId;
      readonly versionId: VersionId;
      readonly size: ThumbnailSize;
    },
  ): Promise<Result<Uint8Array, NotFound>> {
    const roll = (await this.#rolls.get(ctx, input.rollId))?.roll;
    const version = roll && findVersion(roll, input.frameId, input.versionId);
    if (roll === undefined || version === undefined) {
      return err({ kind: 'not-found', entity: 'version', id: input.versionId });
    }
    return ok(
      await this.#previews.thumbnail(version.sha256, input.size, () =>
        this.#blobs.get(ctx, roll.roll, version.file),
      ),
    );
  }
}
