import type { EquipmentSlug } from './equipment-slug.ts';

/** A camera rolls are shot on, e.g. a Nikon FE. */
export interface Camera {
  readonly slug: EquipmentSlug;
  /** What the camera is called, e.g. "Nikon FE". */
  readonly name: string;
}
