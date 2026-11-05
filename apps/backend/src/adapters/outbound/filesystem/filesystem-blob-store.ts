import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type {
  BlobStore,
  NewBlob,
} from '../../../application/ports/blob-store.ts';
import { folderName } from '../../../domain/rolls/folder-names.ts';
import type { RollId } from '../../../domain/shared/ids.ts';
import { findRollFolder } from './roll-folder.ts';
import { safePath } from './safe-path.ts';

/**
 * Image files in the archive, one folder per version inside one per frame:
 * `rolls/YYYY/YYYY-NNN-<ID>/frames/<frame>/<version>/<original name>` (D17,
 * D66). A roll's folder is found by its ID, whatever it's called.
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
      folderName(blob.frameId),
      folderName(blob.versionId),
      blob.fileName,
    ];
    const target = safePath(await this.#rollFolder(blob.rollId), ...names);
    await mkdir(path.dirname(target), { recursive: true });
    // 'wx' fails if the file exists: originals are never overwritten.
    await writeFile(target, bytes, { flag: 'wx' });
    return names.join('/');
  }

  async get(_ctx: unknown, rollId: RollId, file: string): Promise<Uint8Array> {
    // The path comes from roll.json, so it must not lead out of the roll's folder.
    return readFile(
      safePath(await this.#rollFolder(rollId), ...file.split('/')),
    );
  }
}
