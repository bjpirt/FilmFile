import { z } from 'zod';

export const health = z
  .object({
    status: z.literal('ok'),
    exportToFolder: z.boolean().meta({
      description:
        'Whether exports of several frames can be written into a folder chosen in the desktop app, rather than downloaded as a zip (D100).',
    }),
    version: z.string().meta({
      description: "FilmFile's version, such as 0.1.0 (FF-194).",
    }),
    dev: z.boolean().meta({
      description:
        'Whether the service was run from source rather than from a packaged app, shown as "(dev)" beside the version.',
    }),
  })
  .meta({ id: 'Health' });

export type Health = z.infer<typeof health>;
