import type { RollsView } from './view-preference.ts';

export type Grouping = 'none' | 'year' | 'camera' | 'film';

const groupings: readonly string[] = [
  'none',
  'year',
  'camera',
  'film',
] satisfies Grouping[];

/** A camera's or film stock's slug from the address, if it is one. */
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
  /** The slug of the camera the rolls shown were shot on. */
  readonly camera: string | undefined;
  /** The slug of the film stock the rolls shown are. */
  readonly film: string | undefined;
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
    camera: slugIn(params.get('camera')),
    film: slugIn(params.get('film')),
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
  if (address.camera !== undefined) {
    params.set('camera', address.camera);
  }
  if (address.film !== undefined) {
    params.set('film', address.film);
  }
  const query = params.toString();
  return query === '' ? '/' : `/?${query}`;
}
