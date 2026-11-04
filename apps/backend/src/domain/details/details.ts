import type { ShotDate } from '../rolls/shot-date.ts';
import type { Slug } from '../shared/slug.ts';

// The details a frame inherits, layer by layer (design section 6): the
// archive's, then its roll's, then its own.

/** Where a resolved detail came from: the layer, and the ID of what's at it. */
export interface Source {
  readonly layer: 'archive' | 'roll' | 'frame';
  readonly id: string;
}

/** A resolved detail with where it came from, e.g. "lens: Nikkor 105mm — frame". */
export interface Sourced<T> {
  readonly value: T;
  readonly source: Source;
}

/** A list replacing the inherited one, or changes to it. */
export type ListChange<T> =
  | readonly T[]
  | { readonly add?: readonly T[]; readonly remove?: readonly T[] };

/**
 * The inheritable details one layer sets. A detail left out is inherited;
 * null clears what a less specific layer set.
 */
export interface Details {
  readonly author?: string | null;
  readonly copyright?: string | null;
  /** Equipment by slug. */
  readonly camera?: Slug | null;
  readonly film?: Slug | null;
  readonly lens?: Slug | null;
  /** The events it's in, by slug. */
  readonly events?: ListChange<Slug> | null;
  /** When it was shot (D47). */
  readonly shot?: ShotDate | null;
}

/** One layer: what it sets, and where that came from. */
export interface DetailsLayer {
  readonly source: Source;
  readonly details: Details;
}

/** The details a frame ends up with, each with where it came from; those set nowhere are left out. */
export interface ResolvedDetails {
  readonly author?: Sourced<string>;
  readonly copyright?: Sourced<string>;
  readonly camera?: Sourced<Slug>;
  readonly film?: Sourced<Slug>;
  readonly lens?: Sourced<Slug>;
  readonly events?: Sourced<readonly Slug[]>;
  readonly shot?: Sourced<ShotDate>;
}
