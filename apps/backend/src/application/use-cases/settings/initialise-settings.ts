import { defaultRollNumberPattern } from '../../../domain/settings/roll-number-pattern.ts';
import type { Settings } from '../../../domain/settings/settings.ts';
import type { ArchiveContext } from '../../../domain/shared/archive-context.ts';
import type {
  AlreadyExists,
  ValidationFailed,
} from '../../../domain/shared/domain-error.ts';
import { ok, type Result } from '../../../domain/shared/result.ts';
import type { IdGenerator } from '../../ports/id-generator.ts';
import type { SettingsRepository } from '../../ports/settings-repository.ts';
import { textOrNull } from '../rolls/text-or-null.ts';
import { settingsAuthor } from './settings-author.ts';

/**
 * Sets FilmFile up on first run (D43): the author and copyright its frames
 * will inherit. Only once; afterwards the settings are updated.
 */
export class InitialiseSettings {
  readonly #settings: SettingsRepository;
  readonly #ids: IdGenerator;

  constructor(settings: SettingsRepository, ids: IdGenerator) {
    this.#settings = settings;
    this.#ids = ids;
  }

  async execute(
    ctx: ArchiveContext,
    input: {
      readonly author: string;
      readonly copyright?: string | undefined;
    },
  ): Promise<Result<Settings, ValidationFailed | AlreadyExists>> {
    const author = settingsAuthor(input.author);
    if (!author.ok) {
      return author;
    }
    const settings: Settings = {
      id: this.#ids.newArchiveId(),
      author: author.value,
      copyright: textOrNull(input.copyright),
      rollNumberPattern: defaultRollNumberPattern,
    };
    const created = await this.#settings.create(ctx, settings);
    return created.ok ? ok(settings) : created;
  }
}
