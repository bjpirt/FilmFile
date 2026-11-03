import type { Renumbering } from './renumber.ts';

/** The panel's settings, with the number as typed: a whole number when valid. */
export interface RenumberSettings {
  readonly from: Renumbering['from'];
  readonly number: string;
  readonly direction: Renumbering['direction'];
}

/** The settings as a renumbering, or undefined while the number typed isn't a whole number. */
export function renumberingOf(
  settings: RenumberSettings,
): Renumbering | undefined {
  const typed = settings.number.trim();
  return /^-?\d+$/.test(typed)
    ? { ...settings, number: Number(typed) }
    : undefined;
}

/**
 * Renumbering as a sentence: "[First] scan is frame [6], counting [down]",
 * previewed on the contact sheet.
 */
export function RenumberPanel({
  settings,
  change,
  save,
  saving,
  notSaved,
  cancel,
}: {
  readonly settings: RenumberSettings;
  readonly change: (settings: RenumberSettings) => void;
  readonly save: () => void;
  readonly saving: boolean;
  /** The last save failed for a reason other than the roll changing. */
  readonly notSaved: boolean;
  readonly cancel: () => void;
}) {
  const valid = renumberingOf(settings) !== undefined;
  return (
    <fieldset className="renumber">
      <legend>Renumber the roll</legend>
      <span className="sentence">
        <select
          aria-label="Which scan"
          value={settings.from}
          onChange={(event) => {
            change({
              ...settings,
              from: event.target.value === 'last' ? 'last' : 'first',
            });
          }}
        >
          <option value="first">First</option>
          <option value="last">Last</option>
        </select>
        scan is frame
        <span>
          <input
            aria-label={`Frame number of the ${settings.from} scan`}
            inputMode="numeric"
            size={5}
            value={settings.number}
            onChange={(event) => {
              change({ ...settings, number: event.target.value });
            }}
          />
          ,
        </span>
        counting
        <select
          aria-label="Counting"
          value={settings.direction}
          onChange={(event) => {
            change({
              ...settings,
              direction: event.target.value === 'down' ? 'down' : 'up',
            });
          }}
        >
          <option value="up">up</option>
          <option value="down">down</option>
        </select>
      </span>
      <button
        type="button"
        className="primary"
        onClick={save}
        disabled={!valid || saving}
      >
        Save
      </button>
      <button type="button" onClick={cancel} disabled={saving}>
        Cancel
      </button>
      {notSaved && <p role="alert">Couldn't save the numbers.</p>}
      {!valid && <p role="alert">Enter a whole number, like 1 or 36.</p>}
    </fieldset>
  );
}
