import type { EquipmentChoice } from './equipment-choice.ts';

// Option values: '' for none, a slug, or this, which no slug can be.
const addNew = '+new';

/**
 * A dropdown of the archive's cameras, film stocks or lenses: none, each one
 * by its label, then Add new…, which starts a new one from `blank`. The
 * new one's details are asked for beside it.
 */
export function EquipmentSelect<New>({
  label,
  options,
  choice,
  blank,
  change,
}: {
  readonly label: string;
  readonly options: readonly {
    readonly slug: string;
    readonly label: string;
  }[];
  readonly choice: EquipmentChoice<New>;
  readonly blank: New;
  readonly change: (choice: EquipmentChoice<New>) => void;
}) {
  const value =
    choice.kind === 'none'
      ? ''
      : choice.kind === 'existing'
        ? choice.slug
        : addNew;
  // A roll's equipment not among the options loaded (yet) still shows, by slug.
  const unlisted =
    choice.kind === 'existing' &&
    !options.some((option) => option.slug === choice.slug)
      ? choice.slug
      : undefined;

  return (
    <label>
      {label}
      <select
        value={value}
        onChange={(event) => {
          const chosen = event.target.value;
          change(
            chosen === ''
              ? { kind: 'none' }
              : chosen === addNew
                ? { kind: 'new', details: blank }
                : { kind: 'existing', slug: chosen },
          );
        }}
      >
        <option value="">—</option>
        {unlisted !== undefined && <option value={unlisted}>{unlisted}</option>}
        {options.map((option) => (
          <option key={option.slug} value={option.slug}>
            {option.label}
          </option>
        ))}
        <option value={addNew}>Add new…</option>
      </select>
    </label>
  );
}
