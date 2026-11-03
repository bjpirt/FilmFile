import type { EquipmentSlug } from './equipment-slug.ts';

/** A camera rolls are shot on, e.g. a Nikon FE. */
export interface Camera {
  readonly slug: EquipmentSlug;
  /** Who makes it, e.g. "Nikon". */
  readonly make: string;
  /** Which camera it is, e.g. "FE". */
  readonly model: string;
}

/** What a camera is called, e.g. "Nikon FE"; its slug is made from this. */
export function cameraLabel(camera: Pick<Camera, 'make' | 'model'>): string {
  return [camera.make, camera.model].filter((part) => part !== '').join(' ');
}
