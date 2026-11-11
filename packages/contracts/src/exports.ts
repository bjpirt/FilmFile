import { z } from 'zod';
import { ulid } from './rolls.ts';

// Exports made once and downloaded (D95), without saving an export.

export const quickExportRequest = z
  .strictObject({
    frames: z
      .array(z.strictObject({ rollId: ulid, frameId: ulid }))
      .length(1)
      .meta({ description: 'The frame to export; one for now.' }),
    size: z.number().int().min(16).max(20000).nullable().meta({
      description:
        'The longest edge in pixels, or null for the full size. Never enlarges.',
    }),
    quality: z
      .number()
      .int()
      .min(1)
      .max(100)
      .meta({ description: 'JPEG quality, 1 to 100.' }),
    metadata: z.enum(['everything', 'author-and-copyright']).meta({
      description:
        'What the file says about the frame: everything known (author, copyright, title, notes, date, camera, lens, film, keywords, rating, roll and frame number), or only author and copyright. Never a location.',
    }),
  })
  .meta({
    id: 'QuickExportRequest',
    description:
      'What to export once and how: the frame, size, quality and what the file says about the frame.',
  });

export const quickExport = z
  .object({
    url: z.string().meta({
      description:
        'A single-use address that downloads the file, valid for a few minutes.',
      example: '/api/exports/quick/0f8fad5b-d9cb-469f-a165-70867728950e',
    }),
  })
  .meta({ id: 'QuickExport' });

export const quickExportParams = z.object({ ticket: z.uuid() });
