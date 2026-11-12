import { groupPhotos } from './group-photos.ts';
import type { GroupLabel, SitePhoto } from './site-photo.ts';

/** A roll's or event's card on a site, and its own page (D104). */
export interface SiteGroup {
  readonly label: GroupLabel;
  /** Its page, relative to the site's folder: `rolls/<file>.html` or `events/<file>.html`. */
  readonly path: string;
  /** In shot order. */
  readonly photos: readonly SitePhoto[];
  /** Its three highest rated photos, the earliest first among equals. */
  readonly best: readonly SitePhoto[];
  /** The date its card shows: an event's own, else its first frame's. */
  readonly date?: string;
}

/**
 * The photos (in shot order) as a site's rolls or events, newest first by the
 * latest dated frame in each; those with no dated frame, then "No event set",
 * go last.
 */
export function siteGroups(
  photos: readonly SitePhoto[],
  by: 'roll' | 'event',
): SiteGroup[] {
  const place = new Map(photos.map((photo, index) => [photo, index]));
  const latest = (group: readonly SitePhoto[]): number =>
    Math.max(
      -1,
      ...group
        .filter((photo) => photo.details.shot !== undefined)
        .map((photo) => place.get(photo) ?? -1),
    );
  const groups = groupPhotos(photos, by).flatMap(({ label, photos: inIt }) =>
    label === undefined ? [] : [{ label, photos: inIt }],
  );
  const named = groups.filter(({ label }) => label.key !== 'no-event');
  const none = groups.filter(({ label }) => label.key === 'no-event');
  return [
    ...named.sort((a, b) => latest(b.photos) - latest(a.photos)),
    ...none,
  ].map(({ label, photos: inIt }) => {
    const date = label.detail ?? inIt[0]?.details.shot;
    return {
      label,
      path: `${by === 'roll' ? 'rolls' : 'events'}/${label.file}.html`,
      photos: inIt,
      best: [...inIt]
        .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
        .slice(0, 3),
      ...(date === undefined ? {} : { date }),
    };
  });
}
