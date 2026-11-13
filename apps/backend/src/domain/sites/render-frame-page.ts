import { escapeHtml } from './escape-html.ts';
import type { SiteGroup } from './site-groups.ts';
import { captionOrder, type SiteOptions } from './site-options.ts';
import { sitePageShell } from './site-page-shell.ts';
import type { SitePhoto } from './site-photo.ts';

/** A frame's page is two folders down: `rolls/<roll>/<frame>.html`. */
const root = '../../';

function captionOf(photo: SitePhoto, options: SiteOptions): string {
  return captionOrder
    .filter((field) => options.captions.includes(field))
    .map((field) => photo.details[field])
    .filter((text): text is string => text !== undefined && text !== '')
    .join(' · ');
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
        : `<img src="${image(thumb)}" alt="" loading="lazy">`;
    return `<a href="${pageOf(photo)}" aria-label="${escapeHtml(photo.alt)}"${current}>${img}</a>`;
  });
  return `<nav class="filmstrip" aria-label="Filmstrip">${links.join('')}</nav>`;
}

/**
 * A frame's own page, like the app's frame view (D105): a way back to its
 * roll or event and its place there, the photo large between Previous and
 * Next, its caption, and a filmstrip of the roll's or event's frames. Every
 * link works without the script, which adds keys and swiping.
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
  const caption = captionOf(photo, options);
  return sitePageShell({
    title: `${photo.alt} · ${options.title}`,
    siteName: options.title,
    root,
    nameIsHeading: false,
    body: `<div class="frame-bar"><a class="back" href="../${escapeHtml(group.label.file)}.html">← ${escapeHtml(group.label.heading)}</a><p class="place">${String(index + 1)} of ${String(group.photos.length)}</p></div>
<div class="frame-stage">
${stepHtml(group.photos[index - 1], 'previous')}
<img src="${image(widest.src)}" srcset="${srcset}" sizes="100vw" width="${String(photo.width)}" height="${String(photo.height)}" alt="${escapeHtml(photo.alt)}">
${stepHtml(group.photos[index + 1], 'next')}
</div>
${caption === '' ? '' : `<p class="caption">${escapeHtml(caption)}</p>\n`}${filmstripHtml(group, photo)}`,
    after: `<script src="${root}assets/site.js"></script>\n`,
  });
}
