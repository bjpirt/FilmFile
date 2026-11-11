/**
 * The `count` highest rated of some frames, for a card's peek: unrated last,
 * and frames rated the same keep the order they were given in.
 */
export function bestRated<
  T extends { readonly frame: { readonly rating: number | null } },
>(items: readonly T[], count: number): T[] {
  return [...items]
    .sort((a, b) => (b.frame.rating ?? 0) - (a.frame.rating ?? 0))
    .slice(0, count);
}
