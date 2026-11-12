import { escapeHtml } from './escape-html.ts';
import { groupPhotos, type PhotoGroup } from './group-photos.ts';
import { captionOrder, type SiteOptions } from './site-options.ts';
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

/** What the page says when no frames match. */
export const noPhotosText = 'This site has no photos yet.';

/** The screens' widths a photo's `sizes` is written for: one column on a phone. */
const sizes = '(max-width: 40rem) 100vw, 25vw';

function captionOf(photo: SitePhoto, options: SiteOptions): string {
  return captionOrder
    .filter((field) => options.captions.includes(field))
    .map((field) => photo.details[field])
    .filter((text): text is string => text !== undefined && text !== '')
    .join(' · ');
}

function photoHtml(photo: SitePhoto, options: SiteOptions): string {
  const widest = photo.images.at(-1);
  if (widest === undefined) {
    return '';
  }
  const srcset = photo.images
    .map((image) => `${escapeHtml(image.src)} ${String(image.width)}w`)
    .join(', ');
  const caption = captionOf(photo, options);
  const figcaption =
    caption === '' ? '' : `<figcaption>${escapeHtml(caption)}</figcaption>`;
  return `<figure class="photo ${shapeClass(photo)}"><a href="${escapeHtml(widest.src)}"><img src="${escapeHtml(photo.images[0]?.src ?? widest.src)}" srcset="${srcset}" sizes="${sizes}" width="${String(photo.width)}" height="${String(photo.height)}" alt="${escapeHtml(photo.alt)}" loading="lazy"></a>${figcaption}</figure>`;
}

function groupHtml(group: PhotoGroup, options: SiteOptions): string {
  const heading =
    group.label === undefined
      ? ''
      : `<h2>${escapeHtml(group.label.heading)}${
          group.label.detail === undefined
            ? ''
            : ` <small>${escapeHtml(group.label.detail)}</small>`
        }</h2>`;
  const photos = group.photos
    .map((photo) => photoHtml(photo, options))
    .join('\n');
  return `<section class="group">${heading}<div class="grid">\n${photos}\n</div></section>`;
}

function introHtml(intro: string): string {
  const paragraphs = intro
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph !== '');
  return paragraphs.length === 0
    ? ''
    : `<div class="intro">${paragraphs
        .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
        .join('')}</div>`;
}

/**
 * The site's one page: its title and intro, then the photos as a grid,
 * split under headings when grouped. Every link is relative, so it works from
 * any folder or address, and opened straight from the folder.
 */
export function renderSitePage(
  photos: readonly SitePhoto[],
  options: SiteOptions,
): string {
  const groups = groupPhotos(photos, options.groupBy);
  const body =
    groups.length === 0
      ? `<p class="empty">${noPhotosText}</p>`
      : groups.map((group) => groupHtml(group, options)).join('\n');
  const title = escapeHtml(options.title);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<link rel="stylesheet" href="assets/site.css">
</head>
<body>
<main class="page">
<header class="site-header"><h1>${title}</h1>${introHtml(options.intro)}</header>
${body}
</main>
<dialog id="lightbox" aria-label="Photo">
<div class="lightbox">
<img alt="">
<div class="lightbox-bar">
<button type="button" data-previous aria-label="Previous photo">←</button>
<button type="button" data-next aria-label="Next photo">→</button>
<p class="lightbox-caption"></p>
<button type="button" data-close aria-label="Close">✕</button>
</div>
</div>
</dialog>
<script src="assets/site.js"></script>
</body>
</html>
`;
}
