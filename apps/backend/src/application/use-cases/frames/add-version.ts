import { newIdWithUniqueFolder } from '../../../domain/rolls/folder-names.ts';
import type { Roll, Version } from '../../../domain/rolls/roll.ts';
import type { ArchiveContext } from '../../../domain/shared/archive-context.ts';
import type {
  ImageRejected,
  NotFound,
  ScanAlreadyInRoll,
} from '../../../domain/shared/domain-error.ts';
import type { FrameId, RollId } from '../../../domain/shared/ids.ts';
import { err, ok, type Result } from '../../../domain/shared/result.ts';
import type { BlobStore } from '../../ports/blob-store.ts';
import type { Clock } from '../../ports/clock.ts';
import type { IdGenerator } from '../../ports/id-generator.ts';
import type {
  ImageFacts,
  ImageInspector,
} from '../../ports/image-inspector.ts';
import type {
  RollChange,
  RollRepository,
} from '../../ports/roll-repository.ts';

/**
 * Adds an image file, such as a lab scan, as a new version of a frame. The
 * file is stored unchanged. A file whose content is already in the roll is
 * refused, so an interrupted upload can simply be run again.
 */
export class AddVersion {
  readonly #rolls: RollRepository;
  readonly #blobs: BlobStore;
  readonly #inspector: ImageInspector;
  readonly #ids: IdGenerator;
  readonly #clock: Clock;

  constructor(
    rolls: RollRepository,
    blobs: BlobStore,
    inspector: ImageInspector,
    ids: IdGenerator,
    clock: Clock,
  ) {
    this.#rolls = rolls;
    this.#blobs = blobs;
    this.#inspector = inspector;
    this.#ids = ids;
    this.#clock = clock;
  }

  async execute(
    ctx: ArchiveContext,
    input: {
      readonly rollId: RollId;
      readonly frameId: FrameId;
      readonly fileName: string;
      readonly bytes: Uint8Array;
    },
  ): Promise<Result<Version, NotFound | ImageRejected | ScanAlreadyInRoll>> {
    // Inspecting reads the whole file, so it's done before taking the roll's turn.
    const inspected = await this.#inspector.inspect(input.bytes);
    if (!inspected.ok) {
      return inspected;
    }
    return this.#rolls.change(ctx, input.rollId, (roll) =>
      this.#addTo(ctx, roll, inspected.value, input),
    );
  }

  async #addTo(
    ctx: ArchiveContext,
    roll: Roll,
    facts: ImageFacts,
    input: {
      readonly frameId: FrameId;
      readonly fileName: string;
      readonly bytes: Uint8Array;
    },
  ): Promise<Result<RollChange<Version>, NotFound | ScanAlreadyInRoll>> {
    const frame = roll.frames.find((f) => f.id === input.frameId);
    if (frame === undefined) {
      return err({ kind: 'not-found', entity: 'frame', id: input.frameId });
    }
    const holder = roll.frames.find((f) =>
      f.versions.some((v) => v.sha256 === facts.sha256),
    );
    if (holder !== undefined) {
      return err({ kind: 'scan-already-in-roll', frameId: holder.id });
    }

    const versionId = newIdWithUniqueFolder(
      frame.versions.map((v) => v.id),
      () => this.#ids.newVersionId(),
    );
    const file = await this.#blobs.put(
      ctx,
      {
        roll: roll.roll,
        frameId: frame.id,
        versionId,
        fileName: input.fileName,
      },
      input.bytes,
    );
    const version: Version = {
      id: versionId,
      file,
      ...facts,
      added: this.#clock.now(),
      rotate: 0,
    };
    return ok({
      roll: {
        ...roll,
        frames: roll.frames.map((f) =>
          f.id === frame.id ? { ...f, versions: [...f.versions, version] } : f,
        ),
      },
      value: version,
    });
  }
}
