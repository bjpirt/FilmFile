import type { RuleOption } from './use-rule-options.ts';

/**
 * "Any of these", as a list of checkboxes. A value the rule names that the
 * archive no longer has stays ticked, said to be gone, so it can be unticked.
 */
export function ChoiceList({
  legend,
  options,
  chosen,
  change,
}: {
  readonly legend: string;
  /** Undefined until loaded. */
  readonly options: readonly RuleOption[] | undefined;
  readonly chosen: readonly string[];
  readonly change: (chosen: readonly string[]) => void;
}) {
  const gone =
    options === undefined
      ? []
      : chosen.filter((value) => !options.some((o) => o.value === value));
  const shown = [
    ...(options ?? []),
    ...gone.map((value) => ({
      value,
      label: `${value} (no longer in the archive)`,
    })),
  ];
  function toggle(value: string, on: boolean) {
    change(
      on ? [...chosen, value] : chosen.filter((existing) => existing !== value),
    );
  }
  return (
    <fieldset className="rule-choices">
      <legend>{legend}</legend>
      {options === undefined && <p>Loading…</p>}
      {options !== undefined && shown.length === 0 && (
        <p>There is nothing to choose from yet.</p>
      )}
      {options !== undefined && shown.length > 0 && chosen.length === 0 && (
        <p>Choose at least one: with none, no frames match.</p>
      )}
      {shown.map((option) => (
        <label key={option.value}>
          <input
            type="checkbox"
            checked={chosen.includes(option.value)}
            onChange={(event) => {
              toggle(option.value, event.target.checked);
            }}
          />
          {option.label}
        </label>
      ))}
    </fieldset>
  );
}
