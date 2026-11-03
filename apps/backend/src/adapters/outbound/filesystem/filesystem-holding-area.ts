import { glob, mkdir, readFile, rename } from 'node:fs/promises';
import path from 'node:path';
import type {
  Held,
  HeldFrame,
  HeldRoll,
  HoldingArea,
} from '../../../application/ports/holding-area.ts';
import { folderName } from '../../../domain/rolls/folder-names.ts';
import type { ArchiveContext } from '../../../domain/shared/archive-context.ts';
import { hasErrorCode } from './error-codes.ts';
import { rollFolder } from './filesystem-roll-repository.ts';
import { heldFrameFileContent, parseHeldFrameFile } from './held-frame-file.ts';
import { heldRollFileContent, parseHeldRollFile } from './held-roll-file.ts';
import { safePath } from './safe-path.ts';
import { createAtomically } from './write-atomically.ts';

/** A time as a folder name can hold it: `2026-11-02T120000Z`. */
function stamp(at: Date): string {
  return at
    .toISOString()
    .replace(/\.\d+Z$/, 'Z')
    .replaceAll(':', '');
}

/**
 * Deleted things kept in the archive's `deleted/` folder, each in a dated
 * folder of its own: `deleted/2026-11-02T120000Z-frame-01JC8Z…/` holding
 * frame.json and the frame's folder as it was, or
 * `deleted/2026-11-02T120000Z-roll-01JC8Z…/` holding roll-deleted.json and
 * the roll's folder (`2026-014/`) as it was.
 */
export class FilesystemHoldingArea implements HoldingArea {
  readonly #archivePath: string;

  constructor(archivePath: string) {
    this.#archivePath = archivePath;
  }

  /** A new dated folder under deleted/ with its JSON written first; never one that exists. */
  async #newFolder(
    name: string,
    file: string,
    content: string,
  ): Promise<string> {
    await mkdir(safePath(this.#archivePath, 'deleted'), { recursive: true });
    const folder = safePath(this.#archivePath, 'deleted', name);
    // Fails if the folder exists: nothing held is ever overwritten.
    await mkdir(folder);
    if (!(await createAtomically(safePath(folder, file), content))) {
      throw new Error(`${folder} already holds ${file}`);
    }
    return folder;
  }

  async holdFrame(
    _ctx: ArchiveContext,
    held: Omit<HeldFrame, 'kind'>,
  ): Promise<void> {
    const folder = await this.#newFolder(
      `${stamp(held.at)}-frame-${held.frame.id}`,
      'frame.json',
      heldFrameFileContent(held),
    );
    const frameFolder = folderName(held.frame.id);
    try {
      await rename(
        safePath(
          rollFolder(this.#archivePath, held.roll),
          'frames',
          frameFolder,
        ),
        safePath(folder, frameFolder),
      );
    } catch (error) {
      // A frame with no versions may have no folder.
      if (!hasErrorCode(error, 'ENOENT')) {
        throw error;
      }
    }
  }

  async holdRoll(
    _ctx: ArchiveContext,
    held: Omit<HeldRoll, 'kind'>,
  ): Promise<void> {
    const folder = await this.#newFolder(
      `${stamp(held.at)}-roll-${held.rollId}`,
      'roll-deleted.json',
      heldRollFileContent(held),
    );
    await rename(
      rollFolder(this.#archivePath, held.roll),
      safePath(folder, held.roll),
    );
  }

  async list(): Promise<readonly Held[]> {
    const held: Held[] = [];
    for await (const relative of glob('deleted/*/{frame,roll-deleted}.json', {
      cwd: this.#archivePath,
    })) {
      const file = safePath(this.#archivePath, ...relative.split(path.sep));
      const text = await readFile(file, 'utf8');
      held.push(
        path.basename(file) === 'frame.json'
          ? parseHeldFrameFile(text)
          : parseHeldRollFile(text),
      );
    }
    return held.sort((a, b) => a.at.getTime() - b.at.getTime());
  }
}
