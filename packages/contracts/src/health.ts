import { z } from 'zod';

export const health = z
  .object({ status: z.literal('ok') })
  .meta({ id: 'Health' });

export type Health = z.infer<typeof health>;
