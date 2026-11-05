import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
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
import { KeyedLock } from '../node/keyed-lock.ts';
import { hasErrorCode } from './error-codes.ts';
import { parseSettingsFile, settingsFileContent } from './settings-file.ts';
import { safePath } from './safe-path.ts';
import { createAtomically, writeAtomically } from './write-atomically.ts';

/** A version token: the SHA-256 of the file's bytes. */
function versionOf(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

/**
 * The settings kept in settings.json at the FilmFile folder's top level,
 * beside the library (D65). Every write is atomic, and saves take turns.
 */
export class FilesystemSettingsRepository implements SettingsRepository {
  readonly #file: string;
  readonly #lock = new KeyedLock();

  constructor(folderPath: string) {
    this.#file = safePath(folderPath, 'settings.json');
  }

  async get(): Promise<VersionedSettings | undefined> {
    let text: string;
    try {
      text = await readFile(this.#file, 'utf8');
    } catch (error) {
      if (hasErrorCode(error, 'ENOENT')) {
        return undefined;
      }
      throw error;
    }
    return { settings: parseSettingsFile(text), version: versionOf(text) };
  }

  async create(
    _ctx: ArchiveContext,
    settings: Settings,
  ): Promise<Result<void, AlreadyExists>> {
    if (await createAtomically(this.#file, settingsFileContent(settings))) {
      return ok(undefined);
    }
    const existing = await this.get();
    return err({
      kind: 'already-exists',
      entity: 'settings',
      id: existing?.settings.id ?? settings.id,
    });
  }

  save(
    _ctx: ArchiveContext,
    settings: Settings,
    expectedVersion: string,
  ): Promise<Result<string, NotFound | ConcurrencyConflict>> {
    return this.#lock.run('settings', async () => {
      const current = await this.get();
      if (current === undefined) {
        return err({ kind: 'not-found', entity: 'settings', id: settings.id });
      }
      if (current.version !== expectedVersion) {
        return err({
          kind: 'concurrency-conflict',
          entity: 'settings',
          id: settings.id,
        });
      }
      const content = settingsFileContent(settings);
      await writeAtomically(this.#file, content);
      return ok(versionOf(content));
    });
  }
}
