/**
 * The camera, film stock or lens chosen for a roll: none, one the archive
 * has (by slug), or a new one with its details as entered.
 */
export type EquipmentChoice<New> =
  | { readonly kind: 'none' }
  | { readonly kind: 'existing'; readonly slug: string }
  | { readonly kind: 'new'; readonly details: New };

export const noEquipment = { kind: 'none' } as const;

/** The choice for a roll's equipment, by slug. */
export function choiceOf<New>(slug: string | null): EquipmentChoice<New> {
  return slug === null ? noEquipment : { kind: 'existing', slug };
}
