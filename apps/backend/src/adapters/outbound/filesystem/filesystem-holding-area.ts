import { glob, mkdir, readFile, rename } from 'node:fs/promises';
import path from 'node:path';
import type {
  HeldFrame,
  HoldingArea,
} from '../../../application/ports/holding-area.ts';
import { folderName } from '../../../domain/rolls/folder-names.ts';
import type { ArchiveContext } from '../../../domain/shared/archive-context.ts';
import { hasErrorCode } from './error-codes.ts';
import { rollFolder } from './filesystem-roll-repository.ts';
import { heldFrameFileContent, parseHeldFrameFile } from './held-frame-file.ts';
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
 * folder of its own, e.g. `deleted/2026-11-02T120000Z-frame-01JC8Z…/`
 * holding frame.json and the frame's folder as it was.
 */
export class FilesystemHoldingArea implements HoldingArea {
  readonly #archivePath: string;

  constructor(archivePath: string) {
    this.#archivePath = archivePath;
  }

  async holdFrame(
    _ctx: ArchiveContext,
    held: Omit<HeldFrame, 'kind'>,
  ): Promise<void> {
    const folder = safePath(
      this.#archivePath,
      'deleted',
      `${stamp(held.at)}-frame-${held.frame.id}`,
    );
    // Fails if the folder exists: nothing held is ever overwritten.
    await mkdir(safePath(this.#archivePath, 'deleted'), { recursive: true });
    await mkdir(folder);
    const written = await createAtomically(
      safePath(folder, 'frame.json'),
      heldFrameFileContent(held),
    );
    if (!written) {
      throw new Error(`${folder} already holds a frame`);
    }
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

  async list(): Promise<readonly HeldFrame[]> {
    const held: HeldFrame[] = [];
    for await (const relative of glob('deleted/*/frame.json', {
      cwd: this.#archivePath,
    })) {
      const file = safePath(this.#archivePath, ...relative.split(path.sep));
      held.push(parseHeldFrameFile(await readFile(file, 'utf8')));
    }
    return held.sort((a, b) => a.at.getTime() - b.at.getTime());
  }
}
