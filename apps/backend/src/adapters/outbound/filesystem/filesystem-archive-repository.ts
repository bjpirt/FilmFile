import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type {
  ArchiveRepository,
  VersionedArchive,
} from '../../../application/ports/archive-repository.ts';
import type { Archive } from '../../../domain/archive/archive.ts';
import type { ArchiveContext } from '../../../domain/shared/archive-context.ts';
import type {
  AlreadyExists,
  ConcurrencyConflict,
  NotFound,
} from '../../../domain/shared/domain-error.ts';
import { err, ok, type Result } from '../../../domain/shared/result.ts';
import { KeyedLock } from '../node/keyed-lock.ts';
import { archiveFileContent, parseArchiveFile } from './archive-file.ts';
import { hasErrorCode } from './error-codes.ts';
import { safePath } from './safe-path.ts';
import { createAtomically, writeAtomically } from './write-atomically.ts';

/** A version token: the SHA-256 of the file's bytes. */
function versionOf(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

/**
 * The archive's details kept in archive.json at its root. Every write is
 * atomic, and saves take turns.
 */
export class FilesystemArchiveRepository implements ArchiveRepository {
  readonly #file: string;
  readonly #lock = new KeyedLock();

  constructor(archivePath: string) {
    this.#file = safePath(archivePath, 'archive.json');
  }

  async get(): Promise<VersionedArchive | undefined> {
    let text: string;
    try {
      text = await readFile(this.#file, 'utf8');
    } catch (error) {
      if (hasErrorCode(error, 'ENOENT')) {
        return undefined;
      }
      throw error;
    }
    return { archive: parseArchiveFile(text), version: versionOf(text) };
  }

  async create(
    _ctx: ArchiveContext,
    archive: Archive,
  ): Promise<Result<void, AlreadyExists>> {
    if (await createAtomically(this.#file, archiveFileContent(archive))) {
      return ok(undefined);
    }
    const existing = await this.get();
    return err({
      kind: 'already-exists',
      entity: 'archive',
      id: existing?.archive.id ?? archive.id,
    });
  }

  save(
    _ctx: ArchiveContext,
    archive: Archive,
    expectedVersion: string,
  ): Promise<Result<string, NotFound | ConcurrencyConflict>> {
    return this.#lock.run('archive', async () => {
      const current = await this.get();
      if (current === undefined) {
        return err({ kind: 'not-found', entity: 'archive', id: archive.id });
      }
      if (current.version !== expectedVersion) {
        return err({
          kind: 'concurrency-conflict',
          entity: 'archive',
          id: archive.id,
        });
      }
      const content = archiveFileContent(archive);
      await writeAtomically(this.#file, content);
      return ok(versionOf(content));
    });
  }
}
