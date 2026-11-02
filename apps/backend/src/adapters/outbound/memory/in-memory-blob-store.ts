import type {
  BlobStore,
  NewBlob,
} from '../../../application/ports/blob-store.ts';
import type { RollNumber } from '../../../domain/rolls/roll-number.ts';

/** Image files kept in memory, for tests. Write-once, like the real store. */
export class InMemoryBlobStore implements BlobStore {
  readonly #files = new Map<string, Uint8Array>();

  put(_ctx: unknown, blob: NewBlob, bytes: Uint8Array): Promise<string> {
    const file = `${blob.frameId}/${blob.versionId}/${blob.fileName}`;
    const key = `${blob.roll}/${file}`;
    if (this.#files.has(key)) {
      return Promise.reject(new Error(`${key} already exists`));
    }
    this.#files.set(key, bytes);
    return Promise.resolve(file);
  }

  get(_ctx: unknown, roll: RollNumber, file: string): Promise<Uint8Array> {
    const bytes = this.#files.get(`${roll}/${file}`);
    return bytes === undefined
      ? Promise.reject(new Error(`no file ${roll}/${file}`))
      : Promise.resolve(bytes);
  }
}
