import { z } from 'zod';
import type { HeldFrame } from '../../../application/ports/holding-area.ts';
import {
  isRollNumber,
  type RollNumber,
} from '../../../domain/rolls/roll-number.ts';
import { isRollId, type RollId } from '../../../domain/shared/ids.ts';
import { frameFromStored, storedFrame, storedFrameOf } from './roll-file.ts';

// The persistence model for a deleted frame: frame.json in its folder under
// deleted/, saying what the frame was and which roll it came from. Its
// versions' paths are as they were in the roll; the frame's folder sits
// beside this file.

const currentSchema = 1;

const storedHeldFrame = z.object({
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
  frame: storedFrame,
});

/** The deleted frame in a frame.json's text; throws if the file isn't one. */
export function parseHeldFrameFile(text: string): HeldFrame {
  const stored = storedHeldFrame.parse(JSON.parse(text));
  return {
    kind: 'frame',
    rollId: stored.roll.id,
    roll: stored.roll.roll,
    frame: frameFromStored(stored.frame),
    at: new Date(stored.deleted),
  };
}

/** A deleted frame as frame.json text: keys in a fixed order, two-space indent, trailing newline. */
export function heldFrameFileContent(held: Omit<HeldFrame, 'kind'>): string {
  const stored: z.input<typeof storedHeldFrame> = {
    schema: currentSchema,
    deleted: held.at.toISOString(),
    roll: { id: held.rollId, roll: held.roll },
    frame: storedFrameOf(held.frame),
  };
  return `${JSON.stringify(stored, null, 2)}\n`;
}
