import { z } from 'zod';
import type { HeldVersion } from '../../../application/ports/holding-area.ts';
import {
  isRollNumber,
  type RollNumber,
} from '../../../domain/rolls/roll-number.ts';
import {
  isFrameId,
  isRollId,
  type FrameId,
  type RollId,
} from '../../../domain/shared/ids.ts';
import {
  storedVersion,
  storedVersionOf,
  versionFromStored,
} from './roll-file.ts';

// The persistence model for a deleted version: version.json in its folder
// under deleted/, saying what the version was and which frame and roll it
// came from. The version's own folder sits beside this file.

const currentSchema = 1;

const storedHeldVersion = z.object({
  schema: z.literal(currentSchema),
  deleted: z.iso.datetime(),
  roll: z.object({
    id: z.custom<RollId>(
      (value) => typeof value === 'string' && isRollId(value),
      'must be a ULID',
    ),
    roll: z.custom<RollNumber>(
      (value) => typeof value === 'string' && isRollNumber(value),
      'must be 1 to 100 characters',
    ),
  }),
  frameId: z.custom<FrameId>(
    (value) => typeof value === 'string' && isFrameId(value),
    'must be a ULID',
  ),
  version: storedVersion,
});

/** The deleted version in a version.json's text; throws if the file isn't one. */
export function parseHeldVersionFile(text: string): HeldVersion {
  const stored = storedHeldVersion.parse(JSON.parse(text));
  return {
    kind: 'version',
    rollId: stored.roll.id,
    roll: stored.roll.roll,
    frameId: stored.frameId,
    version: versionFromStored(stored.version),
    at: new Date(stored.deleted),
  };
}

/** A deleted version as version.json text: keys in a fixed order, two-space indent, trailing newline. */
export function heldVersionFileContent(
  held: Omit<HeldVersion, 'kind'>,
): string {
  const stored: z.input<typeof storedHeldVersion> = {
    schema: currentSchema,
    deleted: held.at.toISOString(),
    roll: { id: held.rollId, roll: held.roll },
    frameId: held.frameId,
    version: storedVersionOf(held.version),
  };
  return `${JSON.stringify(stored, null, 2)}\n`;
}
