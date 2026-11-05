import type { ArchiveContext } from '../../../domain/shared/archive-context.ts';
import type { NotFound } from '../../../domain/shared/domain-error.ts';
import { err, ok, type Result } from '../../../domain/shared/result.ts';
import type {
  SettingsRepository,
  VersionedSettings,
} from '../../ports/settings-repository.ts';

/**
 * The settings, with the version token that lets a later save check they
 * haven't changed; not found until FilmFile is set up.
 */
export class GetSettings {
  readonly #settings: SettingsRepository;

  constructor(settings: SettingsRepository) {
    this.#settings = settings;
  }

  async execute(
    ctx: ArchiveContext,
  ): Promise<Result<VersionedSettings, NotFound>> {
    const found = await this.#settings.get(ctx);
    return found === undefined
      ? err({ kind: 'not-found', entity: 'settings', id: ctx.archiveId })
      : ok(found);
  }
}
