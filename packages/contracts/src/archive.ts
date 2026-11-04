import { z } from 'zod';

// Request and response shapes for the archive's own details.

export const archive = z
  .object({
    id: z.string(),
    author: z.string().meta({
      description: 'Who took the photographs; frames inherit it.',
      example: 'Ben Pirt',
    }),
    copyright: z.string().nullable().meta({
      description: 'The copyright notice; frames inherit it.',
      example: '© Ben Pirt. All rights reserved.',
    }),
  })
  .meta({ id: 'Archive' });

export const createArchiveRequest = z
  .object({
    author: z.string().min(1).max(100),
    copyright: z.string().max(200).optional(),
  })
  .meta({
    id: 'CreateArchiveRequest',
    description: 'Sets the archive up, once (D43).',
  });

export const updateArchiveRequest = z
  .object({
    author: z.string().min(1).max(100).optional(),
    copyright: z.string().max(200).nullable().optional(),
  })
  .meta({
    id: 'UpdateArchiveRequest',
    description:
      'The details to change. A detail left out stays as it is; null clears the copyright. The author can’t be cleared.',
  });

/** The archive's version, from the ETag it was read with, so a change made since isn't overwritten. */
export const archiveIfMatchHeader = z.object({
  'if-match': z
    .string()
    .optional()
    .meta({ description: "The archive's ETag, from when it was read." }),
});

export type Archive = z.infer<typeof archive>;
