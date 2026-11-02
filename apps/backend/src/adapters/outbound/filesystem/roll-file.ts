import { z } from 'zod';
import {
  isRollNumber,
  type RollNumber,
} from '../../../domain/rolls/roll-number.ts';
import type { Roll } from '../../../domain/rolls/roll.ts';
import {
  isFrameId,
  isRollId,
  isVersionId,
  type FrameId,
  type RollId,
  type VersionId,
} from '../../../domain/shared/ids.ts';
import { err, ok, type Result } from '../../../domain/shared/result.ts';

// The persistence model: what roll.json holds, parsed with Zod when read and
// mapped explicitly to and from the domain types.

const currentSchema = 1;

/**
 * Upgrades a roll.json from the schema version it's keyed by to the next one.
 * Files are upgraded in memory when read, and written in the current schema
 * the next time the roll is saved. None yet: schema 1 is the first.
 */
const migrations = new Map<number, (old: object) => object>();

function branded<T extends string>(
  is: (value: string) => value is T,
  message: string,
) {
  return z.custom<T>(
    (value) => typeof value === 'string' && is(value),
    message,
  );
}

const storedVersion = z.object({
  id: branded<VersionId>(isVersionId, 'must be a ULID'),
  file: z.string(),
  sha256: z.string(),
  bytes: z.number().int(),
  width: z.number().int(),
  height: z.number().int(),
  added: z.iso.datetime(),
});

const storedFrame = z.object({
  id: branded<FrameId>(isFrameId, 'must be a ULID'),
  number: z.string().nullable(),
  versions: z.array(storedVersion),
});

const storedRoll = z.object({
  schema: z.literal(currentSchema),
  id: branded<RollId>(isRollId, 'must be a ULID'),
  roll: branded<RollNumber>(
    isRollNumber,
    'must be a roll number like 2026-014',
  ),
  frames: z.array(storedFrame),
});

/** The file brought up to the current schema version, or why it can't be. */
function upgraded(json: unknown): Result<unknown, string> {
  const version = z.object({ schema: z.number().int() }).safeParse(json);
  if (!version.success || typeof json !== 'object' || json === null) {
    return err('it has no schema version');
  }
  if (version.data.schema > currentSchema) {
    return err(
      `it was written by a newer version of FilmFile (schema ${String(version.data.schema)})`,
    );
  }
  let current: object = json;
  for (let schema = version.data.schema; schema < currentSchema; schema += 1) {
    const migrate = migrations.get(schema);
    if (migrate === undefined) {
      return err(`it uses schema ${String(schema)}, which can't be upgraded`);
    }
    current = migrate(current);
  }
  return ok(current);
}

/** The roll in a roll.json file's text, or what's wrong with it. */
export function parseRollFile(text: string): Result<Roll, string> {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return err('it is not valid JSON');
  }
  const current = upgraded(json);
  if (!current.ok) {
    return current;
  }
  const parsed = storedRoll.safeParse(current.value);
  if (!parsed.success) {
    const issues = parsed.error.issues.map(
      (issue) => `${issue.path.join('.')}: ${issue.message}`,
    );
    return err(`it doesn't match the roll format (${issues.join('; ')})`);
  }
  const { id, roll, frames } = parsed.data;
  return ok({
    id,
    roll,
    frames: frames.map((frame) => ({
      ...frame,
      versions: frame.versions.map((version) => ({
        ...version,
        added: new Date(version.added),
      })),
    })),
  });
}

/** A roll as roll.json text: keys in a fixed order, two-space indent, trailing newline. */
export function rollFileContent(roll: Roll): string {
  const stored: z.input<typeof storedRoll> = {
    schema: currentSchema,
    id: roll.id,
    roll: roll.roll,
    frames: roll.frames.map((frame) => ({
      id: frame.id,
      number: frame.number,
      versions: frame.versions.map((version) => ({
        id: version.id,
        file: version.file,
        sha256: version.sha256,
        bytes: version.bytes,
        width: version.width,
        height: version.height,
        added: version.added.toISOString(),
      })),
    })),
  };
  return `${JSON.stringify(stored, null, 2)}\n`;
}
