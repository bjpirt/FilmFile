import { escapeHtml } from './escape-html.ts';
import { isOtherPhotos, type SiteGroup } from './site-groups.ts';
import type { SiteOptions } from './site-options.ts';
import { sitePageShell } from './site-page-shell.ts';
import { yearAndMonth } from './year-and-month.ts';

/** What the home page says when the site has no photos. */
export const noPhotosText = 'This site has no photos yet.';

/** The heading of the section after the years: undated events and undated frames in no event. */
const otherHeading = 'Other';

/** A cover is cropped upright, about half the page wide at most. */
const coverSizes = '(max-width: 40rem) 90vw, 50vw';

const count = (n: number, one: string) =>
  `${String(n)} ${one}${n === 1 ? '' : 's'}`;

function cardHtml(group: SiteGroup): string {
  const cover = group.best[0];
  const first = cover?.images[0];
  const img =
    cover === undefined || first === undefined
      ? ''
      : `<img class="cover" src="${escapeHtml(first.src)}" srcset="${cover.images
          .map((image) => `${escapeHtml(image.src)} ${String(image.width)}w`)
          .join(', ')}" sizes="${coverSizes}" alt="" loading="lazy">`;
  const { month } = yearAndMonth(group.date);
  const meta = [month, count(group.photos.length, 'photo')]
    .filter((part) => part !== undefined)
    .map((part) => escapeHtml(part))
    .join(' · ');
  return `<li class="card"><a href="${escapeHtml(group.path)}">${img}<h3>${escapeHtml(group.label.heading)}</h3><p>${meta}</p></a></li>`;
}

/**
 * The events under their years, newest first, each year ending with its other
 * photos (those in no event); then undated events and other photos.
 */
function sectionsOf(
  events: readonly SiteGroup[],
): { heading: string; groups: SiteGroup[] }[] {
  const years = new Map<string, SiteGroup[]>();
  const other: SiteGroup[] = [];
  for (const group of events) {
    const { year } = yearAndMonth(group.date);
    if (year === undefined) {
      other.push(group);
    } else {
      years.set(year, [...(years.get(year) ?? []), group]);
    }
  }
  return [
    ...[...years]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([heading, groups]) => ({ heading, groups })),
    ...(other.length === 0 ? [] : [{ heading: otherHeading, groups: other }]),
  ];
}

function byRollHtml(rolls: readonly SiteGroup[]): string {
  const links = rolls
    .map(
      (roll) =>
        `<li><a href="${escapeHtml(roll.path)}">${escapeHtml(roll.label.heading)}</a></li>`,
    )
    .join('');
  return `<footer class="by-roll"><h2>By roll</h2><ul>${links}</ul></footer>`;
}

/**
 * A site's home page (D107): its events under their years, newest first,
 * each a card with its cover (its highest rated photo), name, month and
 * count, leading to its page, and each year's frames in no event as "Other
 * photos from" it; then its rolls, listed small at the foot.
 */
export function renderHomePage(
  events: readonly SiteGroup[],
  rolls: readonly SiteGroup[],
  options: SiteOptions,
): string {
  const photos = rolls.reduce((sum, roll) => sum + roll.photos.length, 0);
  const named = events.filter((group) => !isOtherPhotos(group)).length;
  const body =
    events.length === 0
      ? `<p class="empty">${noPhotosText}</p>`
      : `${sectionsOf(events)
          .map(
            ({ heading, groups }) =>
              `<section class="year"><h2>${escapeHtml(heading)}</h2><ul class="cards">${groups.map(cardHtml).join('')}</ul></section>`,
          )
          .join('\n')}
${byRollHtml(rolls)}`;
  return sitePageShell({
    title: options.title,
    siteName: options.title,
    root: '',
    nameIsHeading: true,
    aside: `<p class="site-count">${[
      ...(named === 0 ? [] : [count(named, 'event')]),
      count(photos, 'photograph'),
    ].join(' · ')}</p>`,
    body,
  });
}
