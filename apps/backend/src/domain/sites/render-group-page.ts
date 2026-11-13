import { escapeHtml } from './escape-html.ts';
import { shapeClass } from './photo-shape.ts';
import type { SiteGroup } from './site-groups.ts';
import type { SiteOptions } from './site-options.ts';
import { sitePageShell } from './site-page-shell.ts';
import type { SitePhoto } from './site-photo.ts';

/** The screens' widths a photo's `sizes` is written for: one column on a phone. */
const sizes = '(max-width: 40rem) 100vw, 25vw';

/** A roll's or event's page is a folder down, so its links climb one. */
const root = '../';

const photosCount = (count: number) =>
  count === 1 ? '1 photo' : `${String(count)} photos`;

function photoHtml(group: SiteGroup, photo: SitePhoto): string {
  const widest = photo.images.at(-1);
  if (widest === undefined) {
    return '';
  }
  const src = (path: string) => escapeHtml(root + path);
  const srcset = photo.images
    .map((image) => `${src(image.src)} ${String(image.width)}w`)
    .join(', ');
  const page = escapeHtml(`${group.label.file}/${photo.file}.html`);
  return `<figure class="photo ${shapeClass(photo)}"><a href="${page}"><img src="${src(photo.images[0]?.src ?? widest.src)}" srcset="${srcset}" sizes="${sizes}" width="${String(photo.width)}" height="${String(photo.height)}" alt="${escapeHtml(photo.alt)}" loading="lazy"></a></figure>`;
}

/**
 * A roll's or event's own page: a way back home, its heading, its date and
 * count, then its photos as a grid, each opening its own page (D105).
 */
export function renderGroupPage(
  group: SiteGroup,
  options: SiteOptions,
): string {
  const meta = [group.label.detail, photosCount(group.photos.length)]
    .filter((part) => part !== undefined)
    .map((part) => escapeHtml(part))
    .join(' · ');
  const photos = group.photos
    .map((photo) => photoHtml(group, photo))
    .join('\n');
  return sitePageShell({
    title: `${group.label.heading} · ${options.title}`,
    siteName: options.title,
    root,
    nameIsHeading: false,
    body: `<a class="back" href="${root}index.html">← All events</a>
<h1>${escapeHtml(group.label.heading)}</h1>
<p class="group-meta">${meta}</p>
<div class="grid">
${photos}
</div>`,
  });
}
