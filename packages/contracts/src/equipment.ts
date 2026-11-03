import { z } from 'zod';

// Request and response shapes for equipment: cameras so far.

/** How equipment is named in the archive, made from its name. */
export const equipmentSlug = z
  .string()
  .max(60)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'must be a slug like nikon-fe')
  .meta({ example: 'nikon-fe' });

export const camera = z
  .object({
    slug: equipmentSlug,
    name: z.string().meta({ example: 'Nikon FE' }),
  })
  .meta({ id: 'Camera' });

export const cameraList = z
  .object({ cameras: z.array(camera) })
  .meta({ id: 'CameraList' });

export const createCameraRequest = z
  .object({
    name: z.string().min(1).max(100).meta({
      description: 'What the camera is called; its slug is made from it.',
    }),
  })
  .meta({ id: 'CreateCameraRequest' });

export type Camera = z.infer<typeof camera>;
