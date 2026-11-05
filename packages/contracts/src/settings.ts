import { z } from 'zod';

// Request and response shapes for FilmFile's settings: set up once, then
// changed (D43, D65).

export const settings = z
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
    folder: z.string().meta({
      description:
        "The FilmFile folder's absolute path: read-only, chosen when FilmFile starts (by the desktop app, or FILMFILE_FOLDER) and never set through the API. The one absolute path any response carries (D64).",
      example: '/Users/ben/Pictures/FilmFile',
    }),
  })
  .meta({ id: 'Settings' });

export const createSettingsRequest = z
  .object({
    author: z.string().min(1).max(100),
    copyright: z.string().max(200).optional(),
  })
  .meta({
    id: 'CreateSettingsRequest',
    description:
      'Sets FilmFile up, once (D43). The FilmFile folder can’t be set here.',
  });

export const updateSettingsRequest = z
  .object({
    author: z.string().min(1).max(100).optional(),
    copyright: z.string().max(200).nullable().optional(),
  })
  .meta({
    id: 'UpdateSettingsRequest',
    description:
      'The details to change. A detail left out stays as it is; null clears the copyright. The author can’t be cleared, and the FilmFile folder can’t be set here.',
  });

/** The settings' version, from the ETag they were read with, so a change made since isn't overwritten. */
export const settingsIfMatchHeader = z.object({
  'if-match': z
    .string()
    .optional()
    .meta({ description: "The settings' ETag, from when they were read." }),
});

export type Settings = z.infer<typeof settings>;
