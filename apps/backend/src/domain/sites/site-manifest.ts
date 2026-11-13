import type { SiteOptions } from './site-options.ts';
import type { SitePhoto } from './site-photo.ts';

/**
 * What `site.json` records: the site as it was built, every photo with the
 * words and images it was built from, so a later build can tell what changed
 * (and an upload, what to send).
 */
export interface SiteManifest {
  readonly version: 1;
  /** The version of the site's design it was built with (`siteDesign`). */
  readonly design: number;
  readonly options: SiteOptions;
  readonly photos: readonly SitePhoto[];
}

/** `site.json`'s text: the same manifest always gives the same bytes. */
export function siteManifestJson(manifest: SiteManifest): string {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}
