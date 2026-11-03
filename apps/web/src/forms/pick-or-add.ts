/**
 * What's chosen for a roll from the archive's cameras, film stocks, lenses or
 * events: none, one the archive has (by slug), or a new one with its details
 * as entered.
 */
export type PickOrAdd<New> =
  | { readonly kind: 'none' }
  | { readonly kind: 'existing'; readonly slug: string }
  | { readonly kind: 'new'; readonly details: New };

export const nothingPicked = { kind: 'none' } as const;

/** The choice for what a roll has, by slug. */
export function choiceOf<New>(slug: string | null): PickOrAdd<New> {
  return slug === null ? nothingPicked : { kind: 'existing', slug };
}
