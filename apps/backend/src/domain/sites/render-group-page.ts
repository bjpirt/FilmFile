import { escapeHtml } from './escape-html.ts';
import { shapeClass } from './photo-shape.ts';
import { isOtherPhotos, type SiteGroup } from './site-groups.ts';
import type { SiteOptions } from './site-options.ts';
import { allEventsLink, sitePageShell } from './site-page-shell.ts';
import type { SitePhoto } from './site-photo.ts';

/** The screens' widths a photo's `sizes` is written for: one column on a phone. */
const sizes = '(max-width: 40rem) 100vw, 25vw';

/** An event's page is a folder down, so its links climb one. */
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

/** An event's neighbours on the home page. */
export interface Neighbours {
  readonly newer?: SiteGroup | undefined;
  readonly earlier?: SiteGroup | undefined;
}

function neighboursHtml({ newer, earlier }: Neighbours): string {
  const link = (group: SiteGroup, kind: 'newer' | 'earlier') => {
    const name = escapeHtml(group.label.heading);
    return `<a class="${kind}" href="${escapeHtml(group.label.file)}.html">${
      kind === 'newer'
        ? `<span>Newer</span> ← ${name}`
        : `<span>Earlier</span> ${name} →`
    }</a>`;
  };
  const links = [
    newer === undefined ? '' : link(newer, 'newer'),
    earlier === undefined ? '' : link(earlier, 'earlier'),
  ].join('');
  return links === ''
    ? ''
    : `\n<nav class="neighbours" aria-label="Other events">${links}</nav>`;
}

/**
 * An event's own page (D107): its name large with its date and count beside
 * it, its photos in rows that fill the width, each opening its own page
 * (D105), then the newer and earlier events.
 */
export function renderGroupPage(
  group: SiteGroup,
  options: SiteOptions,
  neighbours: Neighbours = {},
): string {
  // A year's other photos are named by their year already.
  const date = isOtherPhotos(group) ? undefined : group.date;
  const meta = [date, photosCount(group.photos.length)]
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
    aside: allEventsLink(root),
    body: `<div class="title-block"><h1>${escapeHtml(group.label.heading)}</h1><p class="group-meta">${meta}</p></div>
<div class="grid">
${photos}
</div>${neighboursHtml(neighbours)}`,
  });
}
