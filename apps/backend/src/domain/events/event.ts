import type { Slug } from '../shared/slug.ts';

/** Something that happened, which rolls were shot at, e.g. "Iceland 2026". */
export interface Event {
  readonly slug: Slug;
  readonly name: string;
}
