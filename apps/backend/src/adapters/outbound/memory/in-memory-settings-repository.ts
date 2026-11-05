import type {
  SettingsRepository,
  VersionedSettings,
} from '../../../application/ports/settings-repository.ts';
import type { Settings } from '../../../domain/settings/settings.ts';
import type { ArchiveContext } from '../../../domain/shared/archive-context.ts';
import type {
  AlreadyExists,
  ConcurrencyConflict,
  NotFound,
} from '../../../domain/shared/domain-error.ts';
import { err, ok, type Result } from '../../../domain/shared/result.ts';

/** The settings kept in memory, for tests. Versions count up from 1 per save. */
export class InMemorySettingsRepository implements SettingsRepository {
  #stored: VersionedSettings | undefined;
  #saves = 0;

  #store(settings: Settings): string {
    this.#saves += 1;
    const version = String(this.#saves);
    this.#stored = { settings, version };
    return version;
  }

  get(): Promise<VersionedSettings | undefined> {
    return Promise.resolve(this.#stored);
  }

  create(
    _ctx: ArchiveContext,
    settings: Settings,
  ): Promise<Result<void, AlreadyExists>> {
    if (this.#stored !== undefined) {
      return Promise.resolve(
        err({
          kind: 'already-exists',
          entity: 'settings',
          id: this.#stored.settings.id,
        }),
      );
    }
    this.#store(settings);
    return Promise.resolve(ok(undefined));
  }

  save(
    _ctx: ArchiveContext,
    settings: Settings,
    expectedVersion: string,
  ): Promise<Result<string, NotFound | ConcurrencyConflict>> {
    if (this.#stored === undefined) {
      return Promise.resolve(
        err({ kind: 'not-found', entity: 'settings', id: settings.id }),
      );
    }
    if (this.#stored.version !== expectedVersion) {
      return Promise.resolve(
        err({
          kind: 'concurrency-conflict',
          entity: 'settings',
          id: settings.id,
        }),
      );
    }
    return Promise.resolve(ok(this.#store(settings)));
  }
}
