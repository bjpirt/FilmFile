import type { EquipmentSlug } from './equipment-slug.ts';

/** A lens rolls are shot with, e.g. a Nikon Nikkor AI-S 50mm f/1.8. */
export interface Lens {
  readonly slug: EquipmentSlug;
  /** Who makes it, e.g. "Nikon". */
  readonly make: string;
  /** Its own name, e.g. "Nikkor AI-S". */
  readonly name: string;
  /** In millimetres, or null if not given. */
  readonly focalLength: number | null;
  /** The widest f-number, e.g. 1.8, or null if not given. */
  readonly maxAperture: number | null;
}

/**
 * What a lens is called: make, name, focal length and widest aperture, e.g.
 * "Nikon Nikkor AI-S 50mm f/1.8". Its slug is made from this.
 */
export function lensLabel(
  lens: Pick<Lens, 'make' | 'name' | 'focalLength' | 'maxAperture'>,
): string {
  return [
    lens.make,
    lens.name,
    ...(lens.focalLength === null ? [] : [`${String(lens.focalLength)}mm`]),
    ...(lens.maxAperture === null ? [] : [`f/${String(lens.maxAperture)}`]),
  ].join(' ');
}
