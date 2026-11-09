import { chmod, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type {
  BlobStore,
  NewBlob,
  ReadOnlyResult,
} from '../../../application/ports/blob-store.ts';
import {
  frameFolderName,
  versionFolderName,
} from '../../../domain/rolls/folder-names.ts';
import type { RollId } from '../../../domain/shared/ids.ts';
import { hasErrorCode } from './error-codes.ts';
import { findRollFolder } from './roll-folder.ts';
import { safePath } from './safe-path.ts';

/**
 * Image files in the archive, one folder per version inside one per frame:
 * `rolls/YYYY/YYYY-NNN-<ID>/frames/<number>-<ID>/<kind>-<ID>/<original
 * name>` (D66, D69). A roll's folder is found by its ID, whatever it's called.
 */
export class FilesystemBlobStore implements BlobStore {
  readonly #archivePath: string;

  constructor(archivePath: string) {
    this.#archivePath = archivePath;
  }

  async #rollFolder(rollId: RollId): Promise<string> {
    const folder = await findRollFolder(this.#archivePath, rollId);
    if (folder === undefined) {
      throw new Error(`roll ${rollId} has no folder`);
    }
    return folder;
  }

  async put(_ctx: unknown, blob: NewBlob, bytes: Uint8Array): Promise<string> {
    const names = [
      'frames',
      frameFolderName(blob.frameNumber, blob.frameId),
      versionFolderName(blob.kind, blob.versionId),
      blob.fileName,
    ];
    const target = safePath(await this.#rollFolder(blob.rollId), ...names);
    await mkdir(path.dirname(target), { recursive: true });
    // 'wx' fails if the file exists: originals are never overwritten.
    await writeFile(target, bytes, { flag: 'wx' });
    // A guard against overwriting in place (D96): storing never fails over it,
    // and the pass on starting (FF-109) tries again.
    await readOnly(target);
    return names.join('/');
  }

  async get(_ctx: unknown, rollId: RollId, file: string): Promise<Uint8Array> {
    // The path comes from roll.json, so it must not lead out of the roll's folder.
    return readFile(
      safePath(await this.#rollFolder(rollId), ...file.split('/')),
    );
  }

  async makeReadOnly(
    _ctx: unknown,
    rollId: RollId,
    file: string,
  ): Promise<ReadOnlyResult> {
    let target: string;
    try {
      target = safePath(await this.#rollFolder(rollId), ...file.split('/'));
    } catch {
      return 'missing';
    }
    return await readOnly(target);
  }
}

/** The write bits for the owner, group and others. */
const writeBits = 0o222;

/** Clears a file's write permission, keeping the rest of its mode. */
async function readOnly(target: string): Promise<ReadOnlyResult> {
  try {
    const { mode } = await stat(target);
    if ((mode & writeBits) === 0) {
      return 'already';
    }
    await chmod(target, mode & ~writeBits);
    return 'changed';
  } catch (error) {
    return hasErrorCode(error, 'ENOENT') ? 'missing' : 'failed';
  }
}
