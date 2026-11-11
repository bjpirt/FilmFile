import { renderSitePage } from './render-site-page.ts';
import type { SiteOptions } from './site-options.ts';
import type { SitePhoto } from './site-photo.ts';
import { siteScript } from './site-script.ts';
import { siteStylesheet } from './site-stylesheet.ts';

/** A file of the site, by its path relative to the site's folder. */
export interface SiteFile {
  readonly path: string;
  readonly content: string;
}

/**
 * The files of a site that are text (the images are made apart, and
 * `site.json` is its manifest's): the page, its stylesheet and script. The
 * same inputs make byte-identical files.
 */
export function renderSite(
  photos: readonly SitePhoto[],
  options: SiteOptions,
): SiteFile[] {
  return [
    { path: 'index.html', content: renderSitePage(photos, options) },
    { path: 'assets/site.css', content: siteStylesheet },
    { path: 'assets/site.js', content: siteScript },
  ];
}
