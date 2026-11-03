import { z } from 'zod';
import { isSlug, type Slug } from '../../../domain/shared/slug.ts';
import {
  isFrameNumber,
  type FrameNumber,
} from '../../../domain/rolls/frame-number.ts';
import {
  isRollNumber,
  type RollNumber,
} from '../../../domain/rolls/roll-number.ts';
import {
  isQuarterTurn,
  type QuarterTurn,
} from '../../../domain/rolls/quarter-turn.ts';
import { isRating, type Rating } from '../../../domain/rolls/rating.ts';
import type { Frame, Roll } from '../../../domain/rolls/roll.ts';
import { isShotDate, type ShotDate } from '../../../domain/rolls/shot-date.ts';
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

const currentSchema = 2;

/**
 * Upgrades a roll.json from the schema version it's keyed by to the next one.
 * Files are upgraded in memory when read, and written in the current schema
 * the next time the roll is saved.
 */
const migrations = new Map<number, (old: object) => object>([
  // Schema 1 called a roll's notes its description (D40).
  [
    1,
    (old) => {
      const { description, ...rest } = z
        .looseObject({ description: z.unknown().optional() })
        .parse(old);
      return {
        ...rest,
        schema: 2,
        ...(description === undefined ? {} : { notes: description }),
      };
    },
  ],
]);

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
  // Only written when the version is turned, so an unturned one says nothing of it.
  transform: z
    .object({
      rotate: z.custom<QuarterTurn>(
        (value) => typeof value === 'number' && isQuarterTurn(value),
        'must be 0, 90, 180 or 270',
      ),
    })
    .optional(),
});

/** A frame as roll.json (and a deleted frame's frame.json) holds it. */
export const storedFrame = z.object({
  id: branded<FrameId>(isFrameId, 'must be a ULID'),
  number: branded<FrameNumber>(
    isFrameNumber,
    'must be 1 to 9 characters',
  ).nullable(),
  // Added after the first frames were written, which read as having none.
  title: z.string().nullable().default(null),
  rating: z
    .custom<Rating>(
      (value) => typeof value === 'number' && isRating(value),
      'must be 1 to 5 stars',
    )
    .nullable()
    .default(null),
  notes: z.string().nullable().default(null),
  defaultVersion: branded<VersionId>(isVersionId, 'must be a ULID')
    .nullable()
    .default(null),
  versions: z.array(storedVersion),
});

const storedRoll = z.object({
  schema: z.literal(currentSchema),
  id: branded<RollId>(isRollId, 'must be a ULID'),
  roll: branded<RollNumber>(
    isRollNumber,
    'must be a roll number like 2026-014',
  ),
  // Added after the first rolls were written, which read as having none.
  name: z.string().nullable().default(null),
  notes: z.string().nullable().default(null),
  shot: branded<ShotDate>(isShotDate, 'must be a date like 2026-09-14')
    .nullable()
    .default(null),
  event: branded<Slug>(isSlug, 'must be a slug like iceland-2026')
    .nullable()
    .default(null),
  // The roll's inheritable details (design section 6), by equipment slug.
  meta: z
    .object({
      camera: branded<Slug>(isSlug, 'must be a slug like nikon-fe').optional(),
      film: branded<Slug>(
        isSlug,
        'must be a slug like kodak-portra-400',
      ).optional(),
      lens: branded<Slug>(
        isSlug,
        'must be a slug like nikon-nikkor-ai-s-50mm-f-1-8',
      ).optional(),
    })
    .default({}),
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
  const { id, roll, name, notes, shot, event, meta, frames } = parsed.data;
  return ok({
    id,
    roll,
    name,
    notes,
    shot,
    event,
    camera: meta.camera ?? null,
    film: meta.film ?? null,
    lens: meta.lens ?? null,
    frames: frames.map(frameFromStored),
  });
}

/** A frame as read from its stored form. */
export function frameFromStored(stored: z.output<typeof storedFrame>): Frame {
  return {
    ...stored,
    versions: stored.versions.map(({ transform, ...version }) => ({
      ...version,
      added: new Date(version.added),
      rotate: transform?.rotate ?? 0,
    })),
  };
}

/** A frame in its stored form, keys in a fixed order. */
export function storedFrameOf(frame: Frame): z.input<typeof storedFrame> {
  return {
    id: frame.id,
    number: frame.number,
    title: frame.title,
    rating: frame.rating,
    notes: frame.notes,
    defaultVersion: frame.defaultVersion,
    versions: frame.versions.map((version) => ({
      id: version.id,
      file: version.file,
      sha256: version.sha256,
      bytes: version.bytes,
      width: version.width,
      height: version.height,
      added: version.added.toISOString(),
      ...(version.rotate === 0
        ? {}
        : { transform: { rotate: version.rotate } }),
    })),
  };
}

/** A roll as roll.json text: keys in a fixed order, two-space indent, trailing newline. */
export function rollFileContent(roll: Roll): string {
  const stored: z.input<typeof storedRoll> = {
    schema: currentSchema,
    id: roll.id,
    roll: roll.roll,
    name: roll.name,
    notes: roll.notes,
    shot: roll.shot,
    event: roll.event,
    // Only the details a roll has, so its file says nothing of the rest.
    meta: {
      ...(roll.camera === null ? {} : { camera: roll.camera }),
      ...(roll.film === null ? {} : { film: roll.film }),
      ...(roll.lens === null ? {} : { lens: roll.lens }),
    },
    frames: roll.frames.map(storedFrameOf),
  };
  return `${JSON.stringify(stored, null, 2)}\n`;
}
