import { shapeClass, shapeOf } from './photo-shape.ts';
import { renderCardsPage } from './render-cards-page.ts';
import { renderFramePage } from './render-frame-page.ts';
import { renderGroupPage } from './render-group-page.ts';
import { siteGroups } from './site-groups.ts';
import type { SiteOptions } from './site-options.ts';
import type { SiteView } from './site-page-shell.ts';
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

/** The views a site has, the first being its index (D104). */
function viewsOf(options: SiteOptions): readonly SiteView[] {
  switch (options.organiseBy) {
    case 'both':
      return ['events', 'rolls'];
    case 'events':
      return ['events'];
    case 'rolls':
      return ['rolls'];
  }
}

/**
 * The files of a site that are text (the images are made apart, and
 * `site.json` is its manifest's): the cards pages (`index.html`, and
 * `rolls.html` with Both), a page for each event and roll and for each frame
 * in it (D105), the stylesheet and the script. The same inputs make byte-identical files.
 */
export function renderSite(
  photos: readonly SitePhoto[],
  options: SiteOptions,
): SiteFile[] {
  const views = viewsOf(options).map((view, index) => ({
    view,
    path: index === 0 ? 'index.html' : 'rolls.html',
    groups: siteGroups(photos, view === 'events' ? 'event' : 'roll'),
  }));
  return [
    ...views.map(({ view, path, groups }) => ({
      path,
      content: renderCardsPage(groups, view, options),
    })),
    ...views.flatMap(({ view, groups }) =>
      groups.flatMap((group) => [
        { path: group.path, content: renderGroupPage(group, view, options) },
        ...group.photos.map((photo, index) => ({
          path: `${group.path.slice(0, -'.html'.length)}/${photo.file}.html`,
          content: renderFramePage(group, index, view, options),
        })),
      ]),
    ),
    { path: 'assets/site.css', content: stylesheetFor(photos) },
    { path: 'assets/site.js', content: siteScript },
  ];
}
