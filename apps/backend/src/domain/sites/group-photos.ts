import type { GroupBy } from './site-options.ts';
import type { GroupLabel, SitePhoto } from './site-photo.ts';

/** Anything placed under a roll and maybe an event: a site's photo, or a frame found for its preview. */
export interface Groupable {
  readonly roll: GroupLabel;
  readonly event?: GroupLabel;
}

/** What the photos of no event sit under. */
export const noEventHeading = 'No event set';

export interface PhotoGroup<T extends Groupable = SitePhoto> {
  /** Absent when the site isn't split into groups. */
  readonly label?: GroupLabel;
  readonly photos: readonly T[];
}

// Its page is `_no-event.html`: a slug never starts with `_`, so no event's can clash.
const noEvent: GroupLabel = {
  key: 'no-event',
  heading: noEventHeading,
  file: '_no-event',
};

/**
 * Splits photos (already in shot order) under their roll or event, in the
 * order of each group's first photo. Photos in no event go last.
 */
export function groupPhotos<T extends Groupable>(
  photos: readonly T[],
  groupBy: GroupBy,
): PhotoGroup<T>[] {
  if (groupBy === 'nothing') {
    return photos.length === 0 ? [] : [{ photos }];
  }
  const groups = new Map<string, { label: GroupLabel; photos: T[] }>();
  for (const photo of photos) {
    const label = groupBy === 'roll' ? photo.roll : (photo.event ?? noEvent);
    const group = groups.get(label.key);
    if (group === undefined) {
      groups.set(label.key, { label, photos: [photo] });
    } else {
      group.photos.push(photo);
    }
  }
  const all = [...groups.values()];
  return [
    ...all.filter((group) => group.label !== noEvent),
    ...all.filter((group) => group.label === noEvent),
  ];
}
