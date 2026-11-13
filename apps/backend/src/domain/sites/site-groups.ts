import { groupPhotos } from './group-photos.ts';
import type { GroupLabel, SitePhoto } from './site-photo.ts';
import { yearAndMonth } from './year-and-month.ts';

/** An event's card on a site, and its own page (D104, D107). */
export interface SiteGroup {
  readonly label: GroupLabel;
  /** Its page, relative to the site's folder: `events/<file>.html`. */
  readonly path: string;
  /** In shot order. */
  readonly photos: readonly SitePhoto[];
  /** Its three highest rated photos, the earliest first among equals. */
  readonly best: readonly SitePhoto[];
  /** The date its card shows: an event's own, else its first frame's; a year's other photos, the year. */
  readonly date?: string;
}

// The pages of frames in no event start with `_`, which no event's slug can.
const otherPhotosFile = '_no-event';

/** Whether a group is frames in no event ("Other photos"), not an event. */
export function isOtherPhotos(group: SiteGroup): boolean {
  return group.label.file.startsWith(otherPhotosFile);
}

/**
 * Frames in no event, split by the year they were shot (D107): "Other 2026
 * photos" and so on, newest first, then "Other photos" for those undated.
 */
function otherPhotos(
  photos: readonly SitePhoto[],
): { label: GroupLabel; photos: SitePhoto[]; date?: string }[] {
  const years = new Map<string, SitePhoto[]>();
  const undated: SitePhoto[] = [];
  for (const photo of photos) {
    const { year } = yearAndMonth(photo.details.shot);
    if (year === undefined) {
      undated.push(photo);
    } else {
      years.set(year, [...(years.get(year) ?? []), photo]);
    }
  }
  return [
    ...[...years]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([year, inIt]) => ({
        label: {
          key: `${otherPhotosFile}-${year}`,
          heading: `Other ${year} photos`,
          file: `${otherPhotosFile}-${year}`,
        },
        photos: inIt,
        date: year,
      })),
    ...(undated.length === 0
      ? []
      : [
          {
            label: {
              key: otherPhotosFile,
              heading: 'Other photos',
              file: otherPhotosFile,
            },
            photos: undated,
          },
        ]),
  ];
}

/**
 * The photos (in shot order) as a site's events, newest first by the latest
 * dated frame in each; those with no dated frame go last, and frames in no
 * event after them, by year. A site shows no rolls (D107).
 */
export function siteGroups(photos: readonly SitePhoto[]): SiteGroup[] {
  const place = new Map(photos.map((photo, index) => [photo, index]));
  const latest = (group: readonly SitePhoto[]): number =>
    Math.max(
      -1,
      ...group
        .filter((photo) => photo.details.shot !== undefined)
        .map((photo) => place.get(photo) ?? -1),
    );
  const groups = groupPhotos(photos, 'event').flatMap(
    ({ label, photos: inIt }) =>
      label === undefined ? [] : [{ label, photos: inIt }],
  );
  const named = groups
    .filter(({ label }) => label.key !== 'no-event')
    .sort((a, b) => latest(b.photos) - latest(a.photos))
    .map(({ label, photos: inIt }) => {
      const date = label.detail ?? inIt[0]?.details.shot;
      return { label, photos: inIt, ...(date === undefined ? {} : { date }) };
    });
  const none = groups
    .filter(({ label }) => label.key === 'no-event')
    .flatMap(({ photos: inIt }) => otherPhotos(inIt));
  return [...named, ...none].map(({ label, photos: inIt, ...rest }) => ({
    label,
    path: `events/${label.file}.html`,
    photos: inIt,
    best: [...inIt]
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
      .slice(0, 3),
    ...rest,
  }));
}
