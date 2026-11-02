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

// The persistence model: what roll.json holds, parsed with Zod when read and
// mapped explicitly to and from the domain types.

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
  schema: z.literal(1),
  id: branded<RollId>(isRollId, 'must be a ULID'),
  roll: branded<RollNumber>(
    isRollNumber,
    'must be a roll number like 2026-014',
  ),
  frames: z.array(storedFrame),
});

/** The roll in a roll.json file's text. Throws if the file isn't a valid roll. */
export function parseRollFile(text: string): Roll {
  const { id, roll, frames } = storedRoll.parse(JSON.parse(text));
  return {
    id,
    roll,
    frames: frames.map((frame) => ({
      ...frame,
      versions: frame.versions.map((version) => ({
        ...version,
        added: new Date(version.added),
      })),
    })),
  };
}

/** A roll as roll.json text: keys in a fixed order, two-space indent, trailing newline. */
export function rollFileContent(roll: Roll): string {
  const stored: z.input<typeof storedRoll> = {
    schema: 1,
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
