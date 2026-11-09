import { z } from 'zod';
import type { Settings } from '../../../domain/settings/settings.ts';
import { defaultRollNumberPattern } from '../../../domain/settings/roll-number-pattern.ts';
import { isArchiveId, type ArchiveId } from '../../../domain/shared/ids.ts';

// The persistence model for FilmFile's settings: settings.json at the
// FilmFile folder's top level, beside the library (D65). Author and
// copyright sit in `meta`, the archive-wide defaults frames inherit (design
// section 6). The folder's own path isn't stored: the service is told it
// (D64). The roll number pattern (D88) is at the top level, left out while it's
// the default, and the default when a file has none. A `name` written before the archive had none (D44) is ignored, and
// gone the next time the file is saved.

const currentSchema = 1;

const storedSettings = z.object({
  schema: z.literal(currentSchema),
  id: z.custom<ArchiveId>(
    (value) => typeof value === 'string' && isArchiveId(value),
    'must be a ULID',
  ),
  meta: z.object({
    author: z.string().min(1),
    copyright: z.string().optional(),
  }),
  rollNumberPattern: z.string().min(1).optional(),
});

/** The settings in settings.json's text; throws if the file isn't one. */
export function parseSettingsFile(text: string): Settings {
  const { id, meta, rollNumberPattern } = storedSettings.parse(
    JSON.parse(text),
  );
  return {
    id,
    author: meta.author,
    copyright: meta.copyright ?? null,
    rollNumberPattern: rollNumberPattern ?? defaultRollNumberPattern,
  };
}

/** The settings as settings.json text: keys in a fixed order, two-space indent, trailing newline. */
export function settingsFileContent(settings: Settings): string {
  const stored: z.input<typeof storedSettings> = {
    schema: currentSchema,
    id: settings.id,
    meta: {
      author: settings.author,
      // Only a copyright it has, so the file says nothing of a missing one.
      ...(settings.copyright === null ? {} : { copyright: settings.copyright }),
    },
    // Only a chosen pattern, so settings that never changed it stay as they were.
    ...(settings.rollNumberPattern === defaultRollNumberPattern
      ? {}
      : { rollNumberPattern: settings.rollNumberPattern }),
  };
  return `${JSON.stringify(stored, null, 2)}\n`;
}
