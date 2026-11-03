import type { RollsView } from './view-preference.ts';

export type Grouping = 'none' | 'year';

/** By roll number, or by date shot (D9). */
export type Sorting = 'number' | 'shot';

/** What the rolls page shows, kept in its address so reload, back and bookmarks keep it (D23). */
export interface RollsAddress {
  /** Undefined until chosen, so the view remembered in the browser applies. */
  readonly view: RollsView | undefined;
  readonly group: Grouping;
  readonly sort: Sorting;
  readonly year: string | undefined;
}

export function readAddress(search: string): RollsAddress {
  const params = new URLSearchParams(search);
  const view = params.get('view');
  const year = params.get('year');
  return {
    view: view === 'grid' || view === 'list' ? view : undefined,
    group: params.get('group') === 'year' ? 'year' : 'none',
    sort: params.get('sort') === 'shot' ? 'shot' : 'number',
    year: year !== null && /^\d{4}$/.test(year) ? year : undefined,
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
  const query = params.toString();
  return query === '' ? '/' : `/?${query}`;
}
