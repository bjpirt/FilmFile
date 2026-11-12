import { escapeHtml } from './escape-html.ts';
import type { SiteGroup } from './site-groups.ts';
import type { SiteOptions } from './site-options.ts';
import { sitePageShell, type SiteView } from './site-page-shell.ts';

/** What a cards page says when the site has no photos. */
export const noPhotosText = 'This site has no photos yet.';

const photosCount = (count: number) =>
  count === 1 ? '1 photo' : `${String(count)} photos`;

function cardHtml(group: SiteGroup): string {
  const peek = [0, 1, 2]
    .map((i) => {
      const src = group.best[i]?.images[0]?.src;
      return src === undefined
        ? '<span class="peek-empty"></span>'
        : `<img src="${escapeHtml(src)}" alt="" loading="lazy">`;
    })
    .join('');
  const meta = [photosCount(group.photos.length), group.date]
    .filter((part) => part !== undefined)
    .map((part) => escapeHtml(part))
    .join(' · ');
  return `<li class="card"><a href="${escapeHtml(group.path)}"><div class="peek" aria-hidden="true">${peek}</div><h2>${escapeHtml(group.label.heading)}</h2><p>${meta}</p></a></li>`;
}

/**
 * A page of cards, one for each roll or event, each with a peek at its best
 * photos, its name, its count and its date, leading to its page (D104).
 */
export function renderCardsPage(
  groups: readonly SiteGroup[],
  view: SiteView,
  options: SiteOptions,
): string {
  const body =
    groups.length === 0
      ? `<p class="empty">${noPhotosText}</p>`
      : `<ul class="cards">\n${groups.map(cardHtml).join('\n')}\n</ul>`;
  return sitePageShell({
    title: options.title,
    siteName: options.title,
    organiseBy: options.organiseBy,
    view,
    root: '',
    nameIsHeading: true,
    body,
  });
}
