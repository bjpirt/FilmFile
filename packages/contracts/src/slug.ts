import { z } from 'zod';

/** How a camera, film stock, lens or event is named in the archive, made from its name. */
export const slug = z
  .string()
  .max(60)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'must be a slug like nikon-fe')
  .meta({ example: 'nikon-fe' });
