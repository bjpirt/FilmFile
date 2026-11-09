import {
  parseRollNumberPattern,
  shotHasPrecision,
} from '../../../domain/settings/roll-number-pattern.ts';
import type { ArchiveContext } from '../../../domain/shared/archive-context.ts';
import type {
  ConcurrencyConflict,
  NotFound,
  ValidationFailed,
} from '../../../domain/shared/domain-error.ts';
import type { Roll } from '../../../domain/rolls/roll.ts';
import { err, ok, type Result } from '../../../domain/shared/result.ts';
import type { RollRepository } from '../../ports/roll-repository.ts';
import type {
  SettingsRepository,
  VersionedSettings,
} from '../../ports/settings-repository.ts';
import { textOrNull } from '../rolls/text-or-null.ts';
import { settingsAuthor } from './settings-author.ts';

/**
 * Changes the author, copyright or roll number pattern. A detail left out stays as it is; null or
 * blank clears the copyright, but the author can't be cleared (D44). Saved
 * only if the settings haven't changed since the caller read them at
 * `expectedVersion`. A pattern that needs a shot month, day or event is
 * refused while a roll lacks it (D88).
 */
export class UpdateSettings {
  readonly #settings: SettingsRepository;
  readonly #rolls: RollRepository;

  constructor(settings: SettingsRepository, rolls: RollRepository) {
    this.#settings = settings;
    this.#rolls = rolls;
  }

  async execute(
    ctx: ArchiveContext,
    input: {
      readonly expectedVersion: string;
      readonly author?: string | undefined;
      readonly copyright?: string | null | undefined;
      readonly rollNumberPattern?: string | undefined;
    },
  ): Promise<
    Result<VersionedSettings, NotFound | ConcurrencyConflict | ValidationFailed>
  > {
    const author =
      input.author === undefined ? ok(undefined) : settingsAuthor(input.author);
    if (!author.ok) {
      return author;
    }
    const pattern = await this.#pattern(ctx, input.rollNumberPattern);
    if (!pattern.ok) {
      return pattern;
    }
    const current = await this.#settings.get(ctx);
    if (current === undefined) {
      return err({ kind: 'not-found', entity: 'settings', id: ctx.archiveId });
    }
    const settings = {
      ...current.settings,
      ...(author.value === undefined ? {} : { author: author.value }),
      ...(input.copyright === undefined
        ? {}
        : { copyright: textOrNull(input.copyright) }),
      ...(input.rollNumberPattern === undefined
        ? {}
        : { rollNumberPattern: input.rollNumberPattern }),
    };
    const saved = await this.#settings.save(
      ctx,
      settings,
      input.expectedVersion,
    );
    return saved.ok ? ok({ settings, version: saved.value }) : saved;
  }

  /** Whether a new pattern is valid and every roll has what it needs. */
  async #pattern(
    ctx: ArchiveContext,
    pattern: string | undefined,
  ): Promise<Result<void, ValidationFailed>> {
    if (pattern === undefined) {
      return ok(undefined);
    }
    const needs = parseRollNumberPattern(pattern);
    if (!needs.ok) {
      return needs;
    }
    const { rolls } = await this.#rolls.list(ctx);
    const lacking = (
      missing: (roll: Roll) => boolean,
      what: string,
    ): Result<void, ValidationFailed> => {
      const count = rolls.filter(missing).length;
      return count === 0
        ? ok(undefined)
        : err({
            kind: 'validation-failed',
            issues: [
              {
                path: ['rollNumberPattern'],
                message: `needs ${what} on every roll, and ${String(count)} ${count === 1 ? 'roll has' : 'rolls have'} none`,
              },
            ],
          });
    };
    const shot = lacking(
      (roll) => !shotHasPrecision(roll.shot, needs.value.shot),
      needs.value.shot === 'day' ? 'a shot day' : 'a shot month',
    );
    if (!shot.ok) {
      return shot;
    }
    return needs.value.event
      ? lacking((roll) => roll.event === null, 'an event')
      : ok(undefined);
  }
}
