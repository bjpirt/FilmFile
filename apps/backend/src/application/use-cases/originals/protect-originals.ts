import type { ArchiveContext } from '../../../domain/shared/archive-context.ts';
import type { BlobStore } from '../../ports/blob-store.ts';
import type { RollRepository } from '../../ports/roll-repository.ts';

/** What a pass over the originals did. */
export interface ProtectedOriginals {
  /** Files that were writable and now aren't. */
  readonly changed: number;
  /** Files that couldn't be changed: missing, or on a drive that doesn't keep permissions. */
  readonly couldNotChange: number;
}

/**
 * Makes every version's image in the library read-only, so nothing reaching
 * the originals (NegPy through its links, a file manager) can overwrite them
 * in place (FF-109, D96). The files come from each roll's recorded versions,
 * so nothing else is touched, and the files are done one after another so a
 * large library never holds the service up. Run once as the service starts;
 * `put` does it for each new image.
 */
export class ProtectOriginals {
  readonly #rolls: RollRepository;
  readonly #blobs: BlobStore;

  constructor(rolls: RollRepository, blobs: BlobStore) {
    this.#rolls = rolls;
    this.#blobs = blobs;
  }

  async execute(ctx: ArchiveContext): Promise<ProtectedOriginals> {
    const { rolls } = await this.#rolls.list(ctx);
    let changed = 0;
    let couldNotChange = 0;
    for (const roll of rolls) {
      for (const frame of roll.frames) {
        for (const version of frame.versions) {
          const result = await this.#blobs.makeReadOnly(
            ctx,
            roll.id,
            version.file,
          );
          if (result === 'changed') {
            changed += 1;
          } else if (result !== 'already') {
            couldNotChange += 1;
          }
        }
      }
    }
    return { changed, couldNotChange };
  }
}
