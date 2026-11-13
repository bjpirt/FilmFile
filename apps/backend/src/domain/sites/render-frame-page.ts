import { escapeHtml } from './escape-html.ts';
import type { SiteGroup } from './site-groups.ts';
import type { CaptionField, SiteOptions } from './site-options.ts';
import { allEventsLink, sitePageShell } from './site-page-shell.ts';
import type { SitePhoto } from './site-photo.ts';

/** A frame's page is two folders down: `events/<event>/<frame>.html`. */
const root = '../../';

/** A detail chosen for the site and known for the photo, else undefined. */
function chosen(
  photo: SitePhoto,
  options: SiteOptions,
  field: CaptionField,
): string | undefined {
  const text = photo.details[field];
  return options.captions.includes(field) && text !== undefined && text !== ''
    ? text
    : undefined;
}

/** The line under the photo: its title in bold and its date shot, as chosen. */
function captionHtml(photo: SitePhoto, options: SiteOptions): string {
  const title = chosen(photo, options, 'title');
  const shot = chosen(photo, options, 'shot');
  if (title === undefined && shot === undefined) {
    return '';
  }
  const parts = [
    title === undefined ? '' : `<strong>${escapeHtml(title)}</strong>`,
    shot === undefined
      ? ''
      : `<span>${title === undefined ? '' : '· '}${escapeHtml(shot)}</span>`,
  ].filter((part) => part !== '');
  return `<p class="caption">${parts.join(' ')}</p>`;
}

/** The details behind the icon, in a fixed order, with their labels. */
const detailLabels: readonly (readonly [CaptionField, string])[] = [
  ['camera', 'Camera'],
  ['lens', 'Lens'],
  ['film', 'Film stock'],
];

// A small circled "i", drawn in the text's colour.
const infoIcon =
  '<svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="10" cy="10" r="8.25"></circle><path d="M10 9v5M10 6.2v.1"></path></svg>';

/**
 * The details chosen for the site, hidden behind a small icon until it's
 * pressed (the script shows and hides them; with no script they're shown).
 */
function detailsHtml(
  photo: SitePhoto,
  options: SiteOptions,
): {
  readonly toggle: string;
  readonly list: string;
} {
  const items = detailLabels.flatMap(([field, label]) => {
    const text = chosen(photo, options, field);
    return text === undefined
      ? []
      : [`<div><dt>${label}</dt><dd>${escapeHtml(text)}</dd></div>`];
  });
  if (items.length === 0) {
    return { toggle: '', list: '' };
  }
  return {
    toggle: `<button class="info-toggle" type="button" aria-expanded="false" aria-controls="frame-details" aria-label="Details">${infoIcon}</button>`,
    list: `<dl class="frame-details" id="frame-details" hidden>${items.join('')}</dl>`,
  };
}

const pageOf = (photo: SitePhoto) => escapeHtml(`${photo.file}.html`);
const image = (path: string) => escapeHtml(root + path);

function stepHtml(
  photo: SitePhoto | undefined,
  kind: 'previous' | 'next',
): string {
  if (photo === undefined) {
    return '';
  }
  const [label, mark] =
    kind === 'previous' ? ['Previous frame', '‹'] : ['Next frame', '›'];
  return `<a class="step ${kind}" href="${pageOf(photo)}" aria-label="${label}">${mark}</a>`;
}

function filmstripHtml(group: SiteGroup, shown: SitePhoto): string {
  const links = group.photos.map((photo) => {
    const thumb = photo.images[0]?.src;
    const current = photo === shown ? ' aria-current="page"' : '';
    const img =
      thumb === undefined
        ? ''
        : // Sized, so the strip is laid out (and centred) before they load.
          `<img src="${image(thumb)}" width="${String(photo.width)}" height="${String(photo.height)}" alt="" loading="lazy">`;
    return `<a href="${pageOf(photo)}" aria-label="${escapeHtml(photo.alt)}"${current}>${img}</a>`;
  });
  return `<nav class="filmstrip" aria-label="Filmstrip">${links.join('')}</nav>`;
}

/**
 * A frame's own page, like the app's frame view (D105, D107): a way back to
 * its event and its place there, a filmstrip of the event's frames, the photo
 * large between Previous and Next, its title and date, and its other details
 * behind an icon. Every link works without the script, which adds keys,
 * swiping and the icon.
 */
export function renderFramePage(
  group: SiteGroup,
  index: number,
  options: SiteOptions,
): string {
  const photo = group.photos[index];
  const widest = photo?.images.at(-1);
  if (photo === undefined || widest === undefined) {
    return '';
  }
  const srcset = photo.images
    .map((size) => `${image(size.src)} ${String(size.width)}w`)
    .join(', ');
  const caption = captionHtml(photo, options);
  const details = detailsHtml(photo, options);
  const info =
    caption === '' && details.toggle === ''
      ? ''
      : `\n<div class="frame-info">${caption}${details.toggle}${details.list}</div>`;
  return sitePageShell({
    title: `${photo.alt} · ${options.title}`,
    siteName: options.title,
    root,
    nameIsHeading: false,
    aside: allEventsLink(root),
    head: `<noscript><link rel="stylesheet" href="${root}assets/no-script.css"></noscript>\n`,
    body: `<div class="frame-bar"><a class="back" href="../${escapeHtml(group.label.file)}.html">← ${escapeHtml(group.label.heading)}</a><p class="place">${String(index + 1)} / ${String(group.photos.length)}</p></div>
${filmstripHtml(group, photo)}
<div class="frame-stage">
${stepHtml(group.photos[index - 1], 'previous')}
<img src="${image(widest.src)}" srcset="${srcset}" sizes="100vw" width="${String(photo.width)}" height="${String(photo.height)}" alt="${escapeHtml(photo.alt)}">
${stepHtml(group.photos[index + 1], 'next')}
</div>${info}`,
    after: `<script src="${root}assets/site.js"></script>\n`,
  });
}
