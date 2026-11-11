import { z } from 'zod';
import { ulid } from './rolls.ts';

// Exports made once and downloaded (D95), without saving an export.

export const quickExportRequest = z
  .strictObject({
    frames: z
      .array(z.strictObject({ rollId: ulid, frameId: ulid }))
      .min(1)
      .max(1000)
      .meta({
        description:
          'The frames to export, in the order they are put in a zip. A JPEG is of exactly one.',
      }),
    output: z.enum(['jpeg', 'zip']).meta({
      description:
        'One frame as a JPEG, or any number as a zip of JPEGs sent as it is made. A zip leaves out frames that cannot be made, listing them in skipped.txt.',
    }),
    layout: z.enum(['flat', 'roll-folder', 'year-roll']).meta({
      description:
        "Where a zip's files go: all in one place, a folder for each roll, or a folder for each year with one for each roll in it. Ignored for a JPEG.",
    }),
    fileNames: z.string().min(1).max(200).meta({
      description:
        'How files are named, with {roll}, {frame}, {title}, {year} and {original} in it, e.g. {roll}-{frame}.',
      example: '{roll}-{frame}',
    }),
    name: z.string().trim().min(1).max(100).optional().meta({
      description:
        "What to call a zip, e.g. an event's name; left out, it's named for the roll the frames are from.",
      example: 'Iceland 2026',
    }),
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

export const folderExportRequest = quickExportRequest
  .omit({ output: true })
  .meta({
    id: 'FolderExportRequest',
    description:
      'What to write into a folder chosen in the desktop app, and how: the frames, size, quality, what the files say, layout and file names.',
  });

export const startedFolderExport = z
  .object({
    job: z.string().nullable().meta({
      description:
        'The export to ask after, or null if the person cancelled the folder chooser (nothing was written).',
    }),
  })
  .meta({ id: 'StartedFolderExport' });

export const folderExportStatus = z
  .object({
    state: z.enum(['running', 'done', 'cancelled', 'failed']),
    done: z.number().int().meta({
      description: 'Frames dealt with so far, made or left out.',
    }),
    total: z.number().int(),
    written: z.number().int().meta({ description: 'JPEGs written.' }),
    leftOut: z.number().int().meta({
      description:
        'Frames that could not be made, listed in a skipped.txt in the folder.',
    }),
  })
  .meta({ id: 'FolderExportStatus' });

export const folderExportParams = z.object({ job: z.string().min(1).max(20) });
