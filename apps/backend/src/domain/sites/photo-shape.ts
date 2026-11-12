import type { SitePhoto } from './site-photo.ts';

/** A photo's shape as a number, to four places: its width over its height. */
export function shapeOf(photo: SitePhoto): number {
  return Math.round((photo.width / photo.height) * 10000) / 10000;
}

/**
 * The class a photo's shape is set by: not an inline style, so the page works
 * under a strict content security policy wherever it's put.
 */
export function shapeClass(photo: SitePhoto): string {
  return `shape-${String(Math.round(shapeOf(photo) * 10000))}`;
}
