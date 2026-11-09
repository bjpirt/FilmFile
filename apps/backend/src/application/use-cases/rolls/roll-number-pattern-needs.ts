import {
  parseRollNumberPattern,
  shotHasPrecision,
  type RollNumberPatternNeeds,
} from '../../../domain/settings/roll-number-pattern.ts';
import type { ArchiveContext } from '../../../domain/shared/archive-context.ts';
import type { ValidationFailed } from '../../../domain/shared/domain-error.ts';
import { err, ok, type Result } from '../../../domain/shared/result.ts';
import type { SettingsRepository } from '../../ports/settings-repository.ts';

/** What the saved roll number pattern needs of a roll; nothing before FilmFile is set up (D88). */
export async function savedPatternNeeds(
  settings: SettingsRepository,
  ctx: ArchiveContext,
): Promise<RollNumberPatternNeeds | undefined> {
  const saved = await settings.get(ctx);
  if (saved === undefined) {
    return undefined;
  }
  const needs = parseRollNumberPattern(saved.settings.rollNumberPattern);
  return needs.ok ? needs.value : undefined;
}

/**
 * Whether the shot date and event, where being set, are what the pattern
 * needs, so a roll can always be numbered by it (D88). A field not being
 * set (undefined) isn't checked: an unrelated edit never fails over it.
 */
export function rollMeetsPattern(
  needs: RollNumberPatternNeeds | undefined,
  set: {
    readonly shot?: string | null | undefined;
    readonly event?: string | null | undefined;
  },
): Result<void, ValidationFailed> {
  if (needs === undefined) {
    return ok(undefined);
  }
  if (set.shot !== undefined && !shotHasPrecision(set.shot, needs.shot)) {
    return err({
      kind: 'validation-failed',
      issues: [
        {
          path: ['shot'],
          message: `must include the ${needs.shot}, as the roll number pattern uses it`,
        },
      ],
    });
  }
  if (needs.event && set.event === null) {
    return err({
      kind: 'validation-failed',
      issues: [
        {
          path: ['event'],
          message: 'is needed, as the roll number pattern uses the event',
        },
      ],
    });
  }
  return ok(undefined);
}
