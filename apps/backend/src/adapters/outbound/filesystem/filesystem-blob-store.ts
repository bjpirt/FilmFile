import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type {
  BlobStore,
  NewBlob,
} from '../../../application/ports/blob-store.ts';
import { folderName } from '../../../domain/rolls/folder-names.ts';
import type { RollNumber } from '../../../domain/rolls/roll-number.ts';
import { rollFolder } from './filesystem-roll-repository.ts';
import { safePath } from './safe-path.ts';

/**
 * Image files in the archive, one folder per version inside one per frame:
 * `rolls/YYYY/YYYY-NNN/frames/<frame>/<version>/<original name>` (D17).
 */
export class FilesystemBlobStore implements BlobStore {
  readonly #archivePath: string;

  constructor(archivePath: string) {
    this.#archivePath = archivePath;
  }

  async put(_ctx: unknown, blob: NewBlob, bytes: Uint8Array): Promise<string> {
    const names = [
      'frames',
      folderName(blob.frameId),
      folderName(blob.versionId),
      blob.fileName,
    ];
    const target = safePath(rollFolder(this.#archivePath, blob.roll), ...names);
    await mkdir(path.dirname(target), { recursive: true });
    // 'wx' fails if the file exists: originals are never overwritten.
    await writeFile(target, bytes, { flag: 'wx' });
    return names.join('/');
  }

  async get(
    _ctx: unknown,
    roll: RollNumber,
    file: string,
  ): Promise<Uint8Array> {
    // The path comes from roll.json, so it must not lead out of the roll's folder.
    return readFile(
      safePath(rollFolder(this.#archivePath, roll), ...file.split('/')),
    );
  }
}
