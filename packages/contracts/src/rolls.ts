import { z } from 'zod';
import { slug } from './slug.ts';

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

/** How far a version is turned clockwise when shown, in degrees (D41). */
export const quarterTurn = z
  // One literal each: the OpenAPI generator keeps only the first of z.literal([…]).
  .union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)])
  .meta({ description: 'Degrees clockwise: 0, 90, 180 or 270.' });

/** What a version is (D48). */
export const versionKind = z.enum(['scan', 'raw-scan', 'final']).meta({
  description:
    'scan: ready to view, at any resolution; raw-scan: the negative or slide as scanned, not yet processed; final: processed and edited.',
});

export const version = z
  .object({
    id: ulid,
    fileName: z.string().meta({
      description: 'The original file name, without its folder path.',
      example: '12340014.jpg',
    }),
    sha256: z.string(),
    bytes: z.number().int(),
    width: z.number().int(),
    height: z.number().int(),
    added: z.string().meta({ format: 'date-time' }),
    rotate: quarterTurn,
    kind: versionKind,
  })
  .meta({ id: 'Version', description: 'One image file of a frame.' });

/** When a roll was shot: a year, then optionally month, day and local time (D27). */
export const shotDate = z
  .string()
  .regex(
    /^\d{4}(-\d{2}(-\d{2}(T\d{2}:\d{2})?)?)?$/,
    'must be a year, optionally with month, day and time, like 2026, 2026-09, 2026-09-14 or 2026-09-14T15:30',
  )
  .meta({ example: '2026-09-14' });

export const frame = z
  .object({
    id: ulid,
    number: z.string().nullable().meta({
      description: 'The frame number, or null if not known yet.',
      example: '12A',
    }),
    title: z.string().nullable().meta({ example: 'Mill pond, early fog' }),
    rating: z
      .number()
      .int()
      .nullable()
      .meta({ description: '1 to 5 stars, or null for none (D39).' }),
    notes: z.string().nullable(),
    camera: slug.nullable().meta({
      description:
        "The frame's own camera, in place of its roll's, or null to use the roll's.",
    }),
    lens: slug.nullable(),
    event: slug.nullable().meta({
      description: "The frame's own event, or null to use its roll's event.",
    }),
    toScan: z.boolean().meta({
      description: 'Whether this frame is marked for a higher-resolution scan.',
    }),
    shot: shotDate.nullable().meta({
      description:
        "When the frame was shot, in place of its roll's date, or null to use the roll's (D47).",
    }),
    defaultVersion: ulid.nullable().meta({
      description:
        'The version shown for the frame, or null for its first (D46).',
    }),
    versions: z.array(version),
  })
  .meta({ id: 'Frame' });

export const roll = z
  .object({
    id: ulid,
    roll: rollNumber,
    filed: z.boolean(),
    name: z.string().nullable().meta({
      description: 'A name for the roll, or null.',
      example: 'Iceland, first day',
    }),
    notes: z.string().nullable(),
    shot: shotDate.nullable(),
    event: slug.nullable().meta({
      description: 'The slug of the event the roll was shot at, or null.',
    }),
    camera: slug.nullable().meta({
      description: 'The slug of the camera the roll was shot on, or null.',
    }),
    film: slug.nullable().meta({
      description: 'The slug of the film stock the roll is, or null.',
    }),
    lens: slug.nullable().meta({
      description: 'The slug of the lens the roll was shot with, or null.',
    }),
    frames: z.array(frame),
  })
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

export const rollNumberingSnapshot = z
  .object({
    rolls: z.array(z.object({ roll, version: z.string().min(1) })),
    unreadable: z.array(unreadableRoll),
  })
  .meta({ id: 'RollNumberingSnapshot' });

export const rollParams = z.object({ rollId: ulid });

export const frameParams = rollParams.extend({ frameId: ulid });

export const versionParams = frameParams.extend({ versionId: ulid });

export const createRollRequest = z
  .object({
    roll: rollNumber.optional().meta({
      description:
        "The roll's number. Left out, the roll gets the next free number of the year it was shot (D73).",
    }),
    name: z.string().max(100).optional(),
    notes: z.string().max(5000).optional(),
    shot: shotDate,
    event: slug.optional(),
    camera: slug.optional(),
    film: slug.optional(),
    lens: slug.optional(),
  })
  .meta({ id: 'CreateRollRequest' });

export const renumberRollsRequest = z
  .strictObject({
    snapshot: z.array(
      z.strictObject({
        id: ulid,
        version: z.string().min(1),
      }),
    ),
    unreadable: z.array(unreadableRoll),
    changes: z.array(
      z.strictObject({
        id: ulid,
        roll: z.string().regex(/^\d{4}-\d{3,}$/, 'must be a roll number'),
      }),
    ),
  })
  .meta({
    id: 'RenumberRollsRequest',
    description:
      'The versions of every roll considered, unreadable entries, and the proposed number for each roll to change.',
  });

export const updateRollRequest = z
  .object({
    roll: rollNumber.optional(),
    filed: z.boolean().optional(),
    name: z.string().max(100).nullable().optional(),
    notes: z.string().max(5000).nullable().optional(),
    shot: shotDate.nullable().optional(),
    event: slug.nullable().optional(),
    camera: slug.nullable().optional(),
    film: slug.nullable().optional(),
    lens: slug.nullable().optional(),
  })
  .meta({
    id: 'UpdateRollRequest',
    description:
      'The details to change. A detail left out stays as it is; null clears it. A roll number another roll has is refused with an issue on `roll`.',
  });

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
      .optional()
      .meta({ description: 'The new frame number, or null to clear it.' }),
    title: z.string().max(200).nullable().optional(),
    rating: z
      .number()
      .int()
      .min(1)
      .max(5)
      .nullable()
      .optional()
      .meta({ description: '1 to 5 stars, or null to clear the rating.' }),
    notes: z.string().max(5000).nullable().optional(),
    camera: slug.nullable().optional().meta({
      description: "The frame's own camera, or null to use its roll's again.",
    }),
    lens: slug.nullable().optional(),
    event: slug.nullable().optional().meta({
      description: "The frame's own event, or null to use its roll's again.",
    }),
    toScan: z.boolean().optional().meta({
      description: 'Whether this frame is marked for a higher-resolution scan.',
    }),
    shot: shotDate.nullable().optional().meta({
      description:
        "The frame's own date shot, or null to use its roll's again.",
    }),
    defaultVersion: ulid.nullable().optional().meta({
      description:
        'The version to show for the frame, one of its own, or null to show its first (D46).',
    }),
  })
  .meta({
    id: 'UpdateFrameRequest',
    description: 'The details to change; a detail left out stays as it is.',
  });

export const updateFrameNumbersRequest = z
  .strictObject({
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

export const updateFrameDetailsRequest = z
  .strictObject({
    frameIds: z.array(ulid).min(1).max(1000),
    camera: slug.nullable().optional(),
    lens: slug.nullable().optional(),
    event: slug.nullable().optional(),
    toScan: z.boolean().optional(),
  })
  .meta({
    id: 'UpdateFrameDetailsRequest',
    description:
      "Gives every frame listed the same camera, lens or events of its own; a frame's film stock is always its roll's (D45). A detail left out stays as each frame has it; null goes back to the roll's.",
  });

/** Many frames changed in one save: their numbers, or their own details. */
export const updateFramesRequest = z.union([
  updateFrameNumbersRequest,
  updateFrameDetailsRequest,
]);

/** Frames to delete together, as when they're selected: their IDs, separated by commas. */
export const deleteFramesQuery = z.object({
  frameIds: z
    .string()
    .regex(
      /^[0-9A-HJKMNP-TV-Z]{26}(,[0-9A-HJKMNP-TV-Z]{26}){0,999}$/,
      'must be frame IDs separated by commas',
    )
    .meta({ example: '01JC8Z7K3M0000000000000001,01JC8Z7K3M0000000000000002' }),
});

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
    .regex(
      /^[\w-]+\.(jpe?g|png|webp|tiff?|arw)$/i,
      'must be an image file name like 12340014.jpg, edit.png or DSC04412.ARW',
    )
    .meta({
      description: "The image's original file name, kept when it's stored.",
      example: '12340014.jpg',
    }),
  kind: versionKind.optional().meta({
    description: 'What the version is; a scan unless said (D48).',
  }),
});

export const thumbnailQuery = z.object({
  size: z.enum(['small', 'large']).meta({
    description: 'small fits within 400 px, large within 2048 px.',
  }),
  rotate: z
    .enum(['0', '90', '180', '270'])
    .default('0')
    .meta({ description: 'Degrees to turn it clockwise (D41).' }),
});

export const updateVersionRequest = z
  .object({ rotate: quarterTurn.optional(), kind: versionKind.optional() })
  .meta({
    id: 'UpdateVersionRequest',
    description:
      'How the version is turned when shown, or what kind it is; its file is never changed. A detail left out stays as it is.',
  });

/** Where a frame's detail came from: the layer that set it, and the ID of what's at that layer. */
const detailSource = z.object({
  layer: z.enum(['archive', 'roll', 'frame']),
  id: z.string(),
});

function sourced<T extends z.ZodType>(value: T) {
  return z.object({ value, source: detailSource }).optional();
}

export const frameDetails = z
  .object({
    author: sourced(z.string()),
    copyright: sourced(z.string()),
    camera: sourced(slug),
    film: sourced(slug),
    lens: sourced(slug),
    event: sourced(slug),
    shot: sourced(shotDate),
  })
  .meta({
    id: 'FrameDetails',
    description:
      'The details a frame ends up with, inherited from the archive and its roll (design section 6), each with where it came from. A detail set nowhere is left out.',
  });

export type Version = z.infer<typeof version>;
export type FrameDetails = z.infer<typeof frameDetails>;
export type Frame = z.infer<typeof frame>;
export type Roll = z.infer<typeof roll>;
export type UnreadableRoll = z.infer<typeof unreadableRoll>;
export type RollList = z.infer<typeof rollList>;
export type CreateRollRequest = z.infer<typeof createRollRequest>;
export type CreateFrameRequest = z.infer<typeof createFrameRequest>;
