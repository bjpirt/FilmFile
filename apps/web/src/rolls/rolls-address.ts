import type { RollsView } from './view-preference.ts';

export type Grouping = 'none' | 'year' | 'event' | 'camera' | 'film' | 'lens';

const groupings: readonly string[] = [
  'none',
  'year',
  'event',
  'camera',
  'film',
  'lens',
] satisfies Grouping[];

/** An event's, camera's, film stock's or lens's slug from the address, if it is one. */
function slugIn(value: string | null): string | undefined {
  return value !== null && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(value)
    ? value
    : undefined;
}

export function isGrouping(value: string | null): value is Grouping {
  return value !== null && groupings.includes(value);
}

/** By roll number, or by date shot (D9). */
export type Sorting = 'number' | 'shot';

/** What the rolls page shows, kept in its address so reload, back and bookmarks keep it (D23). */
export interface RollsAddress {
  /** Undefined until chosen, so the view remembered in the browser applies. */
  readonly view: RollsView | undefined;
  readonly group: Grouping;
  readonly sort: Sorting;
  readonly year: string | undefined;
  /** The slug of the event the rolls shown were shot at. */
  readonly event: string | undefined;
  /** The slug of the camera the rolls shown were shot on. */
  readonly camera: string | undefined;
  /** The slug of the film stock the rolls shown are. */
  readonly film: string | undefined;
  /** The slug of the lens the rolls shown were shot with. */
  readonly lens: string | undefined;
}

export function readAddress(search: string): RollsAddress {
  const params = new URLSearchParams(search);
  const view = params.get('view');
  const year = params.get('year');
  const group = params.get('group');
  return {
    view: view === 'grid' || view === 'list' ? view : undefined,
    group: isGrouping(group) ? group : 'none',
    sort: params.get('sort') === 'shot' ? 'shot' : 'number',
    year: year !== null && /^\d{4}$/.test(year) ? year : undefined,
    event: slugIn(params.get('event')),
    camera: slugIn(params.get('camera')),
    film: slugIn(params.get('film')),
    lens: slugIn(params.get('lens')),
  };
}

/** The rolls page's address for what it should show, e.g. `/?group=year&year=2026`. */
export function addressOf(address: RollsAddress): string {
  const params = new URLSearchParams();
  if (address.view !== undefined) {
    params.set('view', address.view);
  }
  if (address.group !== 'none') {
    params.set('group', address.group);
  }
  if (address.sort !== 'number') {
    params.set('sort', address.sort);
  }
  if (address.year !== undefined) {
    params.set('year', address.year);
  }
  if (address.event !== undefined) {
    params.set('event', address.event);
  }
  if (address.camera !== undefined) {
    params.set('camera', address.camera);
  }
  if (address.film !== undefined) {
    params.set('film', address.film);
  }
  if (address.lens !== undefined) {
    params.set('lens', address.lens);
  }
  const query = params.toString();
  return query === '' ? '/' : `/?${query}`;
}
