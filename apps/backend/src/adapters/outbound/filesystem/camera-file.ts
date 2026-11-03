import { z } from 'zod';

// The persistence model for a camera: equipment/cameras/<slug>.json. The slug
// is the file name, so the file holds only the rest.

const currentSchema = 1;

const storedCamera = z.object({
  schema: z.literal(currentSchema),
  name: z.string().min(1),
});

/** The camera's name in a camera file's text; throws if the file isn't one. */
export function parseCameraFile(text: string): { readonly name: string } {
  const { name } = storedCamera.parse(JSON.parse(text));
  return { name };
}

/** A camera as file text: keys in a fixed order, two-space indent, trailing newline. */
export function cameraFileContent(camera: { readonly name: string }): string {
  const stored: z.input<typeof storedCamera> = {
    schema: currentSchema,
    name: camera.name,
  };
  return `${JSON.stringify(stored, null, 2)}\n`;
}
