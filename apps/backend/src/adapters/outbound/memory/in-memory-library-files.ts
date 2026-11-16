import { createHash } from 'node:crypto';
import type { LibraryFiles } from '../../../application/ports/library-files.ts';
import type { ArchiveContext } from '../../../domain/shared/archive-context.ts';
import type { ManifestEntry } from '../../../domain/sync/manifest.ts';

/** The library's files in memory, for tests: `files` maps a path from the folder to its bytes. */
export class InMemoryLibraryFiles implements LibraryFiles {
  readonly files = new Map<string, Uint8Array>();

  describe(): Promise<readonly ManifestEntry[]> {
    return Promise.resolve(
      [...this.files]
        .filter(([path]) => !path.split('/').some((n) => n.startsWith('.')))
        .map(([path, bytes]) => ({
          path,
          size: bytes.length,
          sha256: createHash('sha256').update(bytes).digest('hex'),
        }))
        .sort((a, b) => (a.path < b.path ? -1 : 1)),
    );
  }

  read(_ctx: ArchiveContext, path: string): ReadableStream<Uint8Array> {
    const bytes = this.files.get(path);
    if (bytes === undefined || path.split('/').includes('..')) {
      throw new Error(`no such file: ${JSON.stringify(path)}`);
    }
    return new Blob([new Uint8Array(bytes)]).stream();
  }
}
