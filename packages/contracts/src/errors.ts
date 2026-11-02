import { z } from 'zod';

export const errorResponse = z
  .object({ error: z.string() })
  .meta({ id: 'Error', description: 'What went wrong, for a person to read.' });

export const invalidRequestResponse = z
  .object({
    error: z.literal('invalid request'),
    issues: z.array(
      z.object({
        path: z.array(z.union([z.string(), z.number()])),
        message: z.string(),
      }),
    ),
  })
  .meta({
    id: 'InvalidRequest',
    description:
      'Each problem with the request: where it is and what is wrong.',
  });

export type ErrorResponse = z.infer<typeof errorResponse>;
export type InvalidRequestResponse = z.infer<typeof invalidRequestResponse>;
