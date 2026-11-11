import type { GroupBy } from './site-options.ts';
import type { GroupLabel, SitePhoto } from './site-photo.ts';

/** What the photos of no event sit under. */
export const noEventHeading = 'No event set';

export interface PhotoGroup {
  /** Absent when the site isn't split into groups. */
  readonly label?: GroupLabel;
  readonly photos: readonly SitePhoto[];
}

const noEvent: GroupLabel = { key: 'no-event', heading: noEventHeading };

/**
 * Splits photos (already in shot order) under their roll or event, in the
 * order of each group's first photo. Photos in no event go last.
 */
export function groupPhotos(
  photos: readonly SitePhoto[],
  groupBy: GroupBy,
): PhotoGroup[] {
  if (groupBy === 'nothing') {
    return photos.length === 0 ? [] : [{ photos }];
  }
  const groups = new Map<string, { label: GroupLabel; photos: SitePhoto[] }>();
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
