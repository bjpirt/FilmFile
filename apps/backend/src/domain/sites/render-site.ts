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
 * Every text file of a site (the images are made apart): the page, its
 * stylesheet and script, and `site.json`, which records the frames on the
 * site and what each image was made from so a later build can tell what
 * changed. The same inputs make byte-identical files.
 */
export function renderSite(
  photos: readonly SitePhoto[],
  options: SiteOptions,
): SiteFile[] {
  const manifest = {
    version: 1,
    options,
    photos: photos.map((photo) => ({
      frame: photo.frame,
      images: photo.images.map((image) => ({
        src: image.src,
        width: image.width,
        madeFrom: image.madeFrom,
      })),
    })),
  };
  return [
    { path: 'index.html', content: renderSitePage(photos, options) },
    { path: 'assets/site.css', content: siteStylesheet },
    { path: 'assets/site.js', content: siteScript },
    { path: 'site.json', content: `${JSON.stringify(manifest, null, 2)}\n` },
  ];
}
