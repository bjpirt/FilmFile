import type {
  BlobStore,
  NewBlob,
} from '../../../application/ports/blob-store.ts';
import {
  frameFolderName,
  versionFolderName,
} from '../../../domain/rolls/folder-names.ts';
import type { RollId } from '../../../domain/shared/ids.ts';

/** Image files kept in memory, for tests. Write-once, like the real store. */
export class InMemoryBlobStore implements BlobStore {
  readonly #files = new Map<string, Uint8Array>();

  put(_ctx: unknown, blob: NewBlob, bytes: Uint8Array): Promise<string> {
    const file = `frames/${frameFolderName(blob.frameNumber, blob.frameId)}/${versionFolderName(blob.kind, blob.versionId)}/${blob.fileName}`;
    const key = `${blob.rollId}/${file}`;
    if (this.#files.has(key)) {
      return Promise.reject(new Error(`${key} already exists`));
    }
    this.#files.set(key, bytes);
    return Promise.resolve(file);
  }

  get(_ctx: unknown, rollId: RollId, file: string): Promise<Uint8Array> {
    const bytes = this.#files.get(`${rollId}/${file}`);
    return bytes === undefined
      ? Promise.reject(new Error(`no file ${rollId}/${file}`))
      : Promise.resolve(bytes);
  }
}
