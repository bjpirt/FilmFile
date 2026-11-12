import { z } from 'zod';
import { ulid } from './rolls.ts';
import { slug } from './slug.ts';

// Choosing frames by rules and by hand (D93), as a site or export holds it.

/** A year, month or day, as precisely as given: `2026`, `2026-09`, `2026-09-14`. */
const limitDate = z
  .string()
  .regex(
    /^\d{4}(-\d{2}(-\d{2})?)?$/,
    'must be like 2026, 2026-09 or 2026-09-14',
  )
  .refine((value) => {
    const [year, month, day] = value.split('-').map(Number);
    if (month === undefined) {
      return true;
    }
    if (month < 1 || month > 12) {
      return false;
    }
    // Day 0 of the next month is the last day of this one.
    return (
      day === undefined ||
      (day >= 1 && day <= new Date(Date.UTC(year ?? 0, month, 0)).getUTCDate())
    );
  }, 'is not a real date')
  .meta({ example: '2026-09' });

const values = <T extends z.ZodType>(item: T) => z.array(item).max(500);

export const selectionRule = z
  .discriminatedUnion('kind', [
    z.strictObject({
      kind: z.literal('rating'),
      // One literal each: the OpenAPI generator keeps only the first of z.literal([…]).
      atLeast: z.union([
        z.literal(1),
        z.literal(2),
        z.literal(3),
        z.literal(4),
        z.literal(5),
      ]),
    }),
    z.strictObject({ kind: z.literal('event'), events: values(slug) }),
    z.strictObject({ kind: z.literal('roll'), rolls: values(ulid) }),
    z.strictObject({ kind: z.literal('camera'), cameras: values(slug) }),
    z.strictObject({ kind: z.literal('lens'), lenses: values(slug) }),
    z.strictObject({ kind: z.literal('film'), films: values(slug) }),
    z.strictObject({ kind: z.literal('shot-after'), date: limitDate }),
    z.strictObject({ kind: z.literal('shot-before'), date: limitDate }),
    z.strictObject({
      kind: z.literal('has'),
      version: z.enum(['final', 'raw-scan']),
    }),
  ])
  .meta({
    id: 'SelectionRule',
    description:
      'One condition a frame must meet. A list of values is "any of these"; a frame must meet every rule.',
  });

const frameRef = z.strictObject({ rollId: ulid, frameId: ulid });

export const frameSelection = z
  .strictObject({
    rules: z.array(selectionRule).max(50),
    excluded: z.array(frameRef).max(5000).meta({
      description:
        'Frames the rules find that are left off by hand (the × on a frame, D103).',
    }),
  })
  .meta({
    id: 'FrameSelection',
    description:
      'Which frames: those meeting every rule (all of them with no rules), minus those excluded by hand. A hidden frame is never on one.',
  });

export const searchFramesRequest = frameSelection
  .extend({
    groupBy: z.enum(['roll', 'event']).optional().meta({
      description:
        'Also give the frames grouped under their roll or event, as a built site groups them.',
    }),
  })
  .meta({ id: 'SearchFramesRequest' });

const foundFrame = z.object({
  rollId: ulid,
  frameId: ulid,
  excluded: z.boolean().meta({
    description: 'Excluded by hand: found by the rules but not on it.',
  }),
});

export const searchFramesResponse = z
  .object({
    count: z.number().int(),
    frames: z.array(foundFrame),
    groups: z
      .array(
        z.object({
          key: z.string().meta({
            description:
              "The roll's ID or the event's slug; `no-event` for the frames in none.",
          }),
          heading: z.string().meta({ example: '2026-053 Westfjords' }),
          detail: z
            .string()
            .optional()
            .meta({ description: "An event's date.", example: 'Sep 2026' }),
          frames: z.array(foundFrame),
        }),
      )
      .optional()
      .meta({
        description:
          'The frames under their roll or event, in the order of each group’s first frame, when `groupBy` is asked.',
      }),
  })
  .meta({
    id: 'SearchFramesResponse',
    description:
      'The frames the rules find in shot order, the excluded marked, and how many are not excluded.',
  });

export type SelectionRule = z.infer<typeof selectionRule>;
export type FrameSelection = z.infer<typeof frameSelection>;
export type SearchFramesRequest = z.infer<typeof searchFramesRequest>;
export type SearchFramesResponse = z.infer<typeof searchFramesResponse>;
