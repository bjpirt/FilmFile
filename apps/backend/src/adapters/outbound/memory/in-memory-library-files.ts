import { createHash } from 'node:crypto';
import type {
  CheckingWatch,
  LibraryFiles,
} from '../../../application/ports/library-files.ts';
import type { ArchiveContext } from '../../../domain/shared/archive-context.ts';
import type { LibraryFile } from '../../../domain/sync/library-file.ts';
import { rollFileMentions } from '../filesystem/roll-file-mentions.ts';

/** The library's files in memory, for tests: `files` maps a path from the folder to its bytes. */
export class InMemoryLibraryFiles implements LibraryFiles {
  readonly files = new Map<string, Uint8Array>();

  #shown(): [string, Uint8Array][] {
    return [...this.files]
      .filter(([path]) => !path.split('/').some((n) => n.startsWith('.')))
      .sort(([a], [b]) => (a < b ? -1 : 1));
  }

  describe(
    _ctx: ArchiveContext,
    watch?: CheckingWatch,
  ): Promise<readonly LibraryFile[]> {
    if (watch?.signal.aborted === true) {
      return Promise.reject(new DOMException('aborted', 'AbortError'));
    }
    const shown = this.#shown();
    watch?.checked(0, shown.length);
    watch?.checked(shown.length, shown.length);
    return Promise.resolve(
      shown.map(([path, bytes]) => ({
        path,
        size: bytes.length,
        sha256: createHash('sha256').update(bytes).digest('hex'),
        md5: createHash('md5').update(bytes).digest('hex'),
      })),
    );
  }

  sizes(): Promise<
    readonly { readonly path: string; readonly size: number }[]
  > {
    return Promise.resolve(
      this.#shown().map(([path, bytes]) => ({ path, size: bytes.length })),
    );
  }

  mentioned(): Promise<readonly string[]> {
    return Promise.resolve(
      this.#shown()
        .filter(
          ([path]) =>
            path.startsWith('Library/') && path.endsWith('/roll.json'),
        )
        .flatMap(([path, bytes]) =>
          rollFileMentions(path, new TextDecoder().decode(bytes)),
        ),
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
