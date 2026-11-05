import { glob, mkdir, readFile, rename } from 'node:fs/promises';
import path from 'node:path';
import type {
  Held,
  HeldFrame,
  HeldRoll,
  HeldVersion,
  HoldingArea,
} from '../../../application/ports/holding-area.ts';
import { folderName } from '../../../domain/rolls/folder-names.ts';
import type { ArchiveContext } from '../../../domain/shared/archive-context.ts';
import type { RollId } from '../../../domain/shared/ids.ts';
import { hasErrorCode } from './error-codes.ts';
import { findRollFolder } from './roll-folder.ts';
import { heldFrameFileContent, parseHeldFrameFile } from './held-frame-file.ts';
import { heldRollFileContent, parseHeldRollFile } from './held-roll-file.ts';
import {
  heldVersionFileContent,
  parseHeldVersionFile,
} from './held-version-file.ts';
import { safePath } from './safe-path.ts';
import { createAtomically } from './write-atomically.ts';

/** A time as a folder name can hold it: `2026-11-02T120000Z`. */
function stamp(at: Date): string {
  return at
    .toISOString()
    .replace(/\.\d+Z$/, 'Z')
    .replaceAll(':', '');
}

/** What a held thing's JSON file says, by the file's name. */
function heldIn(name: string, text: string): Held {
  switch (name) {
    case 'frame.json':
      return parseHeldFrameFile(text);
    case 'version.json':
      return parseHeldVersionFile(text);
    default:
      return parseHeldRollFile(text);
  }
}

/**
 * Deleted things kept in the archive's `deleted/` folder, each in a dated
 * folder of its own: `deleted/2026-11-02T120000Z-frame-01JC8Z…/` holding
 * frame.json and the frame's folder as it was, or
 * `deleted/2026-11-02T120000Z-roll-01JC8Z…/` holding roll-deleted.json and
 * the roll's folder (`2026-014-Q2P7RM4K/`) as it was, or
 * `deleted/2026-11-02T120000Z-version-01JC8Z…/` holding version.json and the
 * version's folder as it was.
 */
export class FilesystemHoldingArea implements HoldingArea {
  readonly #archivePath: string;

  constructor(archivePath: string) {
    this.#archivePath = archivePath;
  }

  /** The folder a held thing came out of: its roll's, found by its ID, whatever it's called. */
  #rollFolder(rollId: RollId): Promise<string | undefined> {
    return findRollFolder(this.#archivePath, rollId);
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
    const rollFolder = await this.#rollFolder(held.rollId);
    if (rollFolder === undefined) {
      // A roll with no folder has no files of the frame's to move.
      return;
    }
    try {
      await rename(
        safePath(rollFolder, 'frames', frameFolder),
        safePath(folder, frameFolder),
      );
    } catch (error) {
      // A frame with no versions may have no folder.
      if (!hasErrorCode(error, 'ENOENT')) {
        throw error;
      }
    }
  }

  async holdVersion(
    _ctx: ArchiveContext,
    held: Omit<HeldVersion, 'kind'>,
  ): Promise<void> {
    const folder = await this.#newFolder(
      `${stamp(held.at)}-version-${held.version.id}`,
      'version.json',
      heldVersionFileContent(held),
    );
    const versionFolder = folderName(held.version.id);
    const rollFolder = await this.#rollFolder(held.rollId);
    if (rollFolder === undefined) {
      return;
    }
    try {
      await rename(
        safePath(rollFolder, 'frames', folderName(held.frameId), versionFolder),
        safePath(folder, versionFolder),
      );
    } catch (error) {
      // Its files gone already (by hand, say): what it was is still kept.
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
    const rollFolder = await this.#rollFolder(held.rollId);
    if (rollFolder === undefined) {
      throw new Error(`roll ${held.rollId} has no folder to hold`);
    }
    await rename(rollFolder, safePath(folder, path.basename(rollFolder)));
  }

  async list(): Promise<readonly Held[]> {
    const held: Held[] = [];
    for await (const relative of glob(
      'deleted/*/{frame,roll-deleted,version}.json',
      {
        cwd: this.#archivePath,
      },
    )) {
      const file = safePath(this.#archivePath, ...relative.split(path.sep));
      const text = await readFile(file, 'utf8');
      held.push(heldIn(path.basename(file), text));
    }
    return held.sort((a, b) => a.at.getTime() - b.at.getTime());
  }
}
