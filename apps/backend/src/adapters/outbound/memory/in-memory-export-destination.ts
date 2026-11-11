import type {
  ExportDestination,
  ExportFolder,
} from '../../../application/ports/export-destination.ts';
import { numberedPath } from '../../../application/use-cases/exports/export-names.ts';

/** A folder kept in memory, for tests: the files written to it by their paths. */
export class InMemoryExportFolder implements ExportFolder {
  readonly path: string;
  readonly files = new Map<string, Uint8Array>();

  constructor(folder = '/in-memory/exports') {
    this.path = folder;
  }

  write(relativePath: string, bytes: Uint8Array): Promise<string> {
    if (
      relativePath.split('/').some((name) => ['', '.', '..'].includes(name))
    ) {
      return Promise.reject(new Error(`unsafe path: ${relativePath}`));
    }
    for (let n = 1; ; n += 1) {
      const numbered = numberedPath(relativePath, n);
      if (!this.files.has(numbered)) {
        this.files.set(numbered, bytes);
        return Promise.resolve(numbered);
      }
    }
  }
}

/**
 * Stands in for the desktop app in tests: "chooses" the folder it's given (or
 * cancels), and keeps what it's told when an export is finished.
 */
export class InMemoryExportDestination implements ExportDestination {
  readonly #folder: ExportFolder | undefined;
  readonly finishedWith: {
    readonly folder: string;
    readonly written: number;
    readonly leftOut: number;
  }[] = [];

  constructor(folder: ExportFolder | undefined) {
    this.#folder = folder;
  }

  choose(): Promise<ExportFolder | undefined> {
    return Promise.resolve(this.#folder);
  }

  finished(result: {
    readonly folder: string;
    readonly written: number;
    readonly leftOut: number;
  }): void {
    this.finishedWith.push(result);
  }
}
