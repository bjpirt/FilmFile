import { escapeHtml } from './escape-html.ts';
import { shapeClass } from './photo-shape.ts';
import type { SiteGroup } from './site-groups.ts';
import { captionOrder, type SiteOptions } from './site-options.ts';
import { sitePageShell, type SiteView } from './site-page-shell.ts';
import type { SitePhoto } from './site-photo.ts';

/** The screens' widths a photo's `sizes` is written for: one column on a phone. */
const sizes = '(max-width: 40rem) 100vw, 25vw';

/** A roll's or event's page is a folder down, so its links climb one. */
const root = '../';

const photosCount = (count: number) =>
  count === 1 ? '1 photo' : `${String(count)} photos`;

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
  const src = (path: string) => escapeHtml(root + path);
  const srcset = photo.images
    .map((image) => `${src(image.src)} ${String(image.width)}w`)
    .join(', ');
  const caption = captionOf(photo, options);
  const figcaption =
    caption === '' ? '' : `<figcaption>${escapeHtml(caption)}</figcaption>`;
  return `<figure class="photo ${shapeClass(photo)}"><a href="${src(widest.src)}"><img src="${src(photo.images[0]?.src ?? widest.src)}" srcset="${srcset}" sizes="${sizes}" width="${String(photo.width)}" height="${String(photo.height)}" alt="${escapeHtml(photo.alt)}" loading="lazy"></a>${figcaption}</figure>`;
}

const lightbox = `<dialog id="lightbox" aria-label="Photo">
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
<script src="${root}assets/site.js"></script>
`;

/**
 * A roll's or event's own page: a way back to its cards, its heading, its
 * date and count, then its photos as a grid that opens each in the lightbox.
 */
export function renderGroupPage(
  group: SiteGroup,
  view: SiteView,
  options: SiteOptions,
): string {
  const cardsPage =
    view === 'rolls' && options.organiseBy === 'both'
      ? 'rolls.html'
      : 'index.html';
  const back = view === 'rolls' ? '← All rolls' : '← All events';
  const meta = [group.label.detail, photosCount(group.photos.length)]
    .filter((part) => part !== undefined)
    .map((part) => escapeHtml(part))
    .join(' · ');
  const photos = group.photos
    .map((photo) => photoHtml(photo, options))
    .join('\n');
  return sitePageShell({
    title: `${group.label.heading} · ${options.title}`,
    siteName: options.title,
    organiseBy: options.organiseBy,
    view,
    root,
    nameIsHeading: false,
    body: `<a class="back" href="${root}${cardsPage}">${back}</a>
<h1>${escapeHtml(group.label.heading)}</h1>
<p class="group-meta">${meta}</p>
<div class="grid">
${photos}
</div>`,
    after: lightbox,
  });
}
