import { shapeClass, shapeOf } from './photo-shape.ts';
import { renderFramePage } from './render-frame-page.ts';
import { renderGroupPage } from './render-group-page.ts';
import { renderHomePage } from './render-home-page.ts';
import { eventSections } from './event-sections.ts';
import { siteGroups, type SiteGroup } from './site-groups.ts';
import type { SiteOptions } from './site-options.ts';
import type { SitePhoto } from './site-photo.ts';
import { siteScript } from './site-script.ts';
import { siteStylesheet } from './site-stylesheet.ts';

/** A file of the site, by its path relative to the site's folder. */
export interface SiteFile {
  readonly path: string;
  readonly content: string;
}

/** The stylesheet, with a rule for each shape of photo on the site. */
function stylesheetFor(photos: readonly SitePhoto[]): string {
  const shapes = new Map(
    photos.map((photo) => [shapeClass(photo), shapeOf(photo)]),
  );
  const rules = [...shapes]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, shape]) => `.${name} {\n  --shape: ${String(shape)};\n}\n`);
  return rules.length === 0
    ? siteStylesheet
    : `${siteStylesheet}\n/* The shape of each photo, as width over height. */\n${rules.join('')}`;
}

/**
 * The files of a site that are text (the images are made apart, and
 * `site.json` is its manifest's): the home page (D107), a page for each event
 * and for each frame in it (D105), the stylesheet and the script.
 * The same inputs make byte-identical files.
 */
export function renderSite(
  photos: readonly SitePhoto[],
  options: SiteOptions,
): SiteFile[] {
  const events = siteGroups(photos);
  // An event's page steps to its neighbours as the home page shows them.
  const ordered = eventSections(events).flatMap(({ groups }) => groups);
  const neighboursOf = (group: SiteGroup) => {
    const at = ordered.indexOf(group);
    return { newer: ordered[at - 1], earlier: ordered[at + 1] };
  };
  return [
    { path: 'index.html', content: renderHomePage(events, options) },
    ...events.flatMap((group) => [
      {
        path: group.path,
        content: renderGroupPage(group, options, neighboursOf(group)),
      },
      ...group.photos.map((photo, index) => ({
        path: `${group.path.slice(0, -'.html'.length)}/${photo.file}.html`,
        content: renderFramePage(group, index, options),
      })),
    ]),
    { path: 'assets/site.css', content: stylesheetFor(photos) },
    { path: 'assets/site.js', content: siteScript },
  ];
}
