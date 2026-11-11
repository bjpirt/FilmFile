import { z } from 'zod';

export const health = z
  .object({
    status: z.literal('ok'),
    exportToFolder: z.boolean().meta({
      description:
        'Whether exports of several frames can be written into a folder chosen in the desktop app, rather than downloaded as a zip (D100).',
    }),
  })
  .meta({ id: 'Health' });

export type Health = z.infer<typeof health>;
