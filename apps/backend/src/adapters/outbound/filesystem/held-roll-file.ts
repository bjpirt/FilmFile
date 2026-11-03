import { z } from 'zod';
import type { HeldRoll } from '../../../application/ports/holding-area.ts';
import {
  isRollNumber,
  type RollNumber,
} from '../../../domain/rolls/roll-number.ts';
import { isRollId, type RollId } from '../../../domain/shared/ids.ts';

// The persistence model for a deleted roll: roll-deleted.json in its folder
// under deleted/, beside the roll's own folder (with its roll.json and
// frames) as it was.

const currentSchema = 1;

const storedHeldRoll = z.object({
  schema: z.literal(currentSchema),
  deleted: z.iso.datetime(),
  roll: z.object({
    id: z.custom<RollId>(
      (value) => typeof value === 'string' && isRollId(value),
      'must be a ULID',
    ),
    roll: z.custom<RollNumber>(
      (value) => typeof value === 'string' && isRollNumber(value),
      'must be a roll number like 2026-014',
    ),
  }),
});

/** The deleted roll in a roll-deleted.json's text; throws if the file isn't one. */
export function parseHeldRollFile(text: string): HeldRoll {
  const stored = storedHeldRoll.parse(JSON.parse(text));
  return {
    kind: 'roll',
    rollId: stored.roll.id,
    roll: stored.roll.roll,
    at: new Date(stored.deleted),
  };
}

/** A deleted roll as roll-deleted.json text: keys in a fixed order, two-space indent, trailing newline. */
export function heldRollFileContent(held: Omit<HeldRoll, 'kind'>): string {
  const stored: z.input<typeof storedHeldRoll> = {
    schema: currentSchema,
    deleted: held.at.toISOString(),
    roll: { id: held.rollId, roll: held.roll },
  };
  return `${JSON.stringify(stored, null, 2)}\n`;
}
