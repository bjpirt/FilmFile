import type { SiteGroup } from './site-groups.ts';
import { yearAndMonth } from './year-and-month.ts';

/** The heading of the section after the years: undated events and undated frames in no event. */
const otherHeading = 'Other';

/**
 * The events under their years, newest first, each year ending with its other
 * photos (those in no event); then undated events and other photos. The
 * home page shows them so, and an event's page steps through them in this
 * order (D107).
 */
export function eventSections(
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
