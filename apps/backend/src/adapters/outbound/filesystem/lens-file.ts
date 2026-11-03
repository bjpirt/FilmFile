import { z } from 'zod';
import type { Lens } from '../../../domain/equipment/lens.ts';

// The persistence model for a lens: equipment/lenses/<slug>.json. The slug is
// the file name, so the file holds only the rest.

const currentSchema = 1;

const storedLens = z.object({
  schema: z.literal(currentSchema),
  make: z.string().min(1),
  name: z.string().min(1),
  focalLength: z.number().positive().nullable().default(null),
  maxAperture: z.number().positive().nullable().default(null),
});

type LensDetails = Omit<Lens, 'slug'>;

/** The lens's details in a lens file's text; throws if the file isn't one. */
export function parseLensFile(text: string): LensDetails {
  const { make, name, focalLength, maxAperture } = storedLens.parse(
    JSON.parse(text),
  );
  return { make, name, focalLength, maxAperture };
}

/** A lens as file text: keys in a fixed order, two-space indent, trailing newline. */
export function lensFileContent(lens: LensDetails): string {
  const stored: z.input<typeof storedLens> = {
    schema: currentSchema,
    make: lens.make,
    name: lens.name,
    focalLength: lens.focalLength,
    maxAperture: lens.maxAperture,
  };
  return `${JSON.stringify(stored, null, 2)}\n`;
}
