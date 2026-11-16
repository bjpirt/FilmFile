import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import type { LibraryFiles } from '../../../application/ports/library-files.ts';
import type { ArchiveContext } from '../../../domain/shared/archive-context.ts';
import type { ManifestEntry } from '../../../domain/sync/manifest.ts';
import { hasErrorCode } from './error-codes.ts';
import { safePath } from './safe-path.ts';
import { writeAtomically } from './write-atomically.ts';

// The hashes worked out before, by path, kept with the size and modified
// time they were for (D120). A cache: losing it only means hashing again.
const cachedHashes = z.record(
  z.string(),
  z.object({ size: z.number(), modified: z.number(), sha256: z.string() }),
);
type CachedHashes = z.infer<typeof cachedHashes>;

const hidden = (name: string) => name.startsWith('.');

/** A file's bytes, a chunk at a time, read as they're asked for. */
async function* chunksOf(file: string): AsyncGenerator<Uint8Array> {
  for await (const chunk of createReadStream(file)) {
    if (Buffer.isBuffer(chunk)) {
      yield new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength);
    }
  }
}

async function sha256Of(file: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) {
    if (Buffer.isBuffer(chunk)) {
      hash.update(chunk);
    }
  }
  return hash.digest('hex');
}

/**
 * The FilmFile folder's files a sync backs up: `Library/…` and
 * `settings.json`, leaving out names starting with `.` (D120). Their
 * SHA-256s are cached in the cache folder, never in the FilmFile folder.
 */
export class FilesystemLibraryFiles implements LibraryFiles {
  readonly #folder: string;
  readonly #cacheFile: string;
  readonly #cacheFolder: string;

  constructor(folderPath: string, cachePath: string) {
    this.#folder = folderPath;
    this.#cacheFolder = cachePath;
    this.#cacheFile = safePath(cachePath, 'sync-hashes.json');
  }

  async #cached(): Promise<CachedHashes> {
    try {
      return cachedHashes.parse(
        JSON.parse(await readFile(this.#cacheFile, 'utf8')),
      );
    } catch {
      return {};
    }
  }

  /** Every file's path from the folder, under `Library/`, and `settings.json` if it's there. */
  async #paths(): Promise<string[]> {
    const library = safePath(this.#folder, 'Library');
    const entries = await readdir(library, {
      recursive: true,
      withFileTypes: true,
    });
    const paths = entries
      .filter((entry) => entry.isFile())
      .map((entry) =>
        path
          .relative(this.#folder, path.join(entry.parentPath, entry.name))
          .split(path.sep),
      )
      .filter((names) => !names.some(hidden))
      .map((names) => names.join('/'));
    try {
      if ((await stat(safePath(this.#folder, 'settings.json'))).isFile()) {
        paths.push('settings.json');
      }
    } catch (error) {
      if (!hasErrorCode(error, 'ENOENT')) {
        throw error;
      }
    }
    return paths.sort();
  }

  async describe(): Promise<readonly ManifestEntry[]> {
    const cached = await this.#cached();
    const next: CachedHashes = {};
    const files: ManifestEntry[] = [];
    for (const relative of await this.#paths()) {
      const file = safePath(this.#folder, ...relative.split('/'));
      const { size, mtimeMs } = await stat(file);
      // Whole milliseconds: finer than that doesn't survive every filesystem.
      const modified = Math.trunc(mtimeMs);
      const known = cached[relative];
      const sha256 =
        known?.size === size && known.modified === modified
          ? known.sha256
          : await sha256Of(file);
      next[relative] = { size, modified, sha256 };
      files.push({ path: relative, size, sha256 });
    }
    await mkdir(this.#cacheFolder, { recursive: true });
    await writeAtomically(this.#cacheFile, JSON.stringify(next));
    return files;
  }

  read(_ctx: ArchiveContext, relative: string): ReadableStream<Uint8Array> {
    const names = relative.split('/');
    if (names.some(hidden)) {
      throw new Error(`not a file a sync sends: ${JSON.stringify(relative)}`);
    }
    const file = safePath(this.#folder, ...names);
    const chunks = chunksOf(file);
    return new ReadableStream<Uint8Array>({
      async pull(controller) {
        const next = await chunks.next();
        if (next.done === true) {
          controller.close();
        } else {
          controller.enqueue(next.value);
        }
      },
      async cancel() {
        await chunks.return(undefined);
      },
    });
  }
}
