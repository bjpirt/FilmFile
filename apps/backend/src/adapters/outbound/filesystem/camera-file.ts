import { z } from 'zod';
import type { Camera } from '../../../domain/equipment/camera.ts';

// The persistence model for a camera: equipment/cameras/<slug>.json. The slug
// is the file name, so the file holds only the rest.

const currentSchema = 2;

const storedCamera = z.object({
  schema: z.literal(currentSchema),
  make: z.string().min(1),
  // Can be empty in a camera upgraded from a one-word name.
  model: z.string(),
});

/** Schema 1 held one name; schema 2 splits it: the first word is the make. */
const fromSchema1 = z
  .object({ schema: z.literal(1), name: z.string().min(1) })
  .transform(({ name }) => {
    const [make = '', ...model] = name.trim().split(/\s+/);
    return { schema: currentSchema, make, model: model.join(' ') };
  });

type CameraDetails = Omit<Camera, 'slug'>;

/** The camera's details in a camera file's text, upgraded if older; throws if the file isn't one. */
export function parseCameraFile(text: string): CameraDetails {
  const json: unknown = JSON.parse(text);
  const old = fromSchema1.safeParse(json);
  const { make, model } = storedCamera.parse(old.success ? old.data : json);
  return { make, model };
}

/** A camera as file text: keys in a fixed order, two-space indent, trailing newline. */
export function cameraFileContent(camera: CameraDetails): string {
  const stored: z.input<typeof storedCamera> = {
    schema: currentSchema,
    make: camera.make,
    model: camera.model,
  };
  return `${JSON.stringify(stored, null, 2)}\n`;
}
