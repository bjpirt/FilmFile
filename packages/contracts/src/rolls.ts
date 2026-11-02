import { z } from 'zod';

// Request and response shapes for rolls, their frames and the frames' versions.

const ulid = z
  .string()
  .regex(/^[0-9A-HJKMNP-TV-Z]{26}$/, 'must be a ULID')
  .meta({ example: '01M6EAAP694BKWR9HZ4N5Z54XD' });

export const rollNumber = z
  .string()
  .regex(/^\d{4}-\d{3}$/, 'must be a roll number like 2026-014')
  .meta({
    description: 'The year the roll was shot and a number, YYYY-NNN.',
    example: '2026-014',
  });

export const version = z
  .object({
    id: ulid,
    file: z.string().meta({
      description: "Where the file is, relative to the roll's folder.",
      example: 'frames/S9WDVXNP/9PMYF63D/12340014.jpg',
    }),
    sha256: z.string(),
    bytes: z.number().int(),
    width: z.number().int(),
    height: z.number().int(),
    added: z.string().meta({ format: 'date-time' }),
  })
  .meta({ id: 'Version', description: 'One image file of a frame.' });

export const frame = z
  .object({
    id: ulid,
    number: z.string().nullable().meta({
      description: 'The frame number, or null if not known yet.',
      example: '12A',
    }),
    versions: z.array(version),
  })
  .meta({ id: 'Frame' });

export const roll = z
  .object({ id: ulid, roll: rollNumber, frames: z.array(frame) })
  .meta({ id: 'Roll' });

export const unreadableRoll = z
  .object({
    folder: z.string().meta({
      description: "The roll's folder name, which should be its roll number.",
      example: '2026-014',
    }),
    problem: z.string().meta({
      description: "What's wrong with its roll.json, for a person to fix.",
    }),
  })
  .meta({ id: 'UnreadableRoll' });

export const rollList = z
  .object({ rolls: z.array(roll), unreadable: z.array(unreadableRoll) })
  .meta({ id: 'RollList' });

export const rollParams = z.object({ rollId: ulid });

export const frameParams = rollParams.extend({ frameId: ulid });

export const versionParams = frameParams.extend({ versionId: ulid });

export const createRollRequest = z
  .object({ roll: rollNumber })
  .meta({ id: 'CreateRollRequest' });

/** The number printed on the film beside a frame: any text of 1 to 9 characters (D19). */
export const frameNumber = z
  .string()
  .min(1, 'must be 1 to 9 characters, like 23 or 12A')
  .max(9, 'must be 1 to 9 characters, like 23 or 12A')
  .meta({ example: '12A' });

export const createFrameRequest = z
  .object({ number: frameNumber.optional() })
  .meta({ id: 'CreateFrameRequest' });

export const updateFrameRequest = z
  .object({
    number: frameNumber
      .nullable()
      .meta({ description: 'The new frame number, or null to clear it.' }),
  })
  .meta({ id: 'UpdateFrameRequest' });

export const updateFrameNumbersRequest = z
  .object({
    numbers: z.array(
      z.object({
        frameId: ulid,
        number: frameNumber
          .nullable()
          .meta({ description: 'The new frame number, or null to clear it.' }),
      }),
    ),
  })
  .meta({ id: 'UpdateFrameNumbersRequest' });

/** The roll's version, from the ETag it was read with, so a changed roll isn't overwritten. */
export const ifMatchHeader = z.object({
  'if-match': z
    .string()
    .optional()
    .meta({ description: "The roll's ETag, from when it was read." }),
});

export const addVersionQuery = z.object({
  file: z
    .string()
    .regex(/^[\w-]+\.jpe?g$/i, 'must be a JPEG file name like 12340014.jpg')
    .meta({
      description: "The scan's original file name, kept when it's stored.",
      example: '12340014.jpg',
    }),
});

export const thumbnailQuery = z.object({
  size: z.enum(['small', 'large']).meta({
    description: 'small fits within 400 px, large within 2048 px.',
  }),
});

export type Version = z.infer<typeof version>;
export type Frame = z.infer<typeof frame>;
export type Roll = z.infer<typeof roll>;
export type UnreadableRoll = z.infer<typeof unreadableRoll>;
export type RollList = z.infer<typeof rollList>;
export type CreateRollRequest = z.infer<typeof createRollRequest>;
export type CreateFrameRequest = z.infer<typeof createFrameRequest>;
