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

/** The archive kept in memory, for tests. Versions count up from 1 per save. */
export class InMemoryArchiveRepository implements ArchiveRepository {
  #stored: VersionedArchive | undefined;
  #saves = 0;

  #store(archive: Archive): string {
    this.#saves += 1;
    const version = String(this.#saves);
    this.#stored = { archive, version };
    return version;
  }

  get(): Promise<VersionedArchive | undefined> {
    return Promise.resolve(this.#stored);
  }

  create(
    _ctx: ArchiveContext,
    archive: Archive,
  ): Promise<Result<void, AlreadyExists>> {
    if (this.#stored !== undefined) {
      return Promise.resolve(
        err({
          kind: 'already-exists',
          entity: 'archive',
          id: this.#stored.archive.id,
        }),
      );
    }
    this.#store(archive);
    return Promise.resolve(ok(undefined));
  }

  save(
    _ctx: ArchiveContext,
    archive: Archive,
    expectedVersion: string,
  ): Promise<Result<string, NotFound | ConcurrencyConflict>> {
    if (this.#stored === undefined) {
      return Promise.resolve(
        err({ kind: 'not-found', entity: 'archive', id: archive.id }),
      );
    }
    if (this.#stored.version !== expectedVersion) {
      return Promise.resolve(
        err({
          kind: 'concurrency-conflict',
          entity: 'archive',
          id: archive.id,
        }),
      );
    }
    return Promise.resolve(ok(this.#store(archive)));
  }
}
