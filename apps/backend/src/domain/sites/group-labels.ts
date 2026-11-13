import type { Event } from '../events/event.ts';
import { rollFolderName } from '../rolls/folder-names.ts';
import type { Roll } from '../rolls/roll.ts';
import { shotLabel } from './shot-label.ts';
import type { GroupLabel } from './site-photo.ts';

/** A roll's heading on a site and in its preview: its number and name. */
export function rollGroupLabel(
  roll: Pick<Roll, 'id' | 'roll' | 'name'>,
): GroupLabel {
  return {
    key: roll.id,
    heading: [roll.roll, roll.name].filter(Boolean).join(' '),
    // The roll's number and the last of its ID, as its folder is named, so two
    // rolls numbered alike can't clash.
    file: rollFolderName(roll.roll, roll.id),
  };
}

/** An event's heading on a site and in its preview: its name, and its date beside it. */
export function eventGroupLabel(event: Event): GroupLabel {
  return {
    key: event.slug,
    heading: event.name,
    ...(event.date === null ? {} : { detail: shotLabel(event.date) }),
    file: event.slug,
  };
}
