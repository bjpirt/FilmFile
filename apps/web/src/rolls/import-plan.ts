import { dateInFolderName } from './folder-name-date.ts';
import type { ImportFolder } from './import-folders.ts';
import {
  suggestImportedNumber,
  type RollNumberPattern,
} from './roll-number-pattern.ts';
import { shotFrom, type ShotFields } from './shot-fields.ts';

/** A folder in the preview: whether it's to be imported, and the date shot it will have. */
export interface ImportRow {
  readonly folder: ImportFolder;
  readonly shot: ShotFields;
  readonly included: boolean;
}

/** A row with what importing it would do: the date to send and the number it gets, undefined while its date isn't right. */
export interface PlannedRow extends ImportRow {
  readonly shotDate: string | undefined;
  readonly number: string | undefined;
}

/** Each folder as a row, dated by its name where it has a date, else by `thisYear`. */
export function rowsFor(
  folders: readonly ImportFolder[],
  thisYear: string,
): ImportRow[] {
  return folders.map((folder) => {
    const named = dateInFolderName(folder.name);
    return {
      folder,
      included: true,
      shot: {
        year: named?.year ?? thisYear,
        month: named?.month ?? '',
        day: named?.day ?? '',
        time: '',
      },
    };
  });
}

/** The date to send for a row's fields, if they're a real date with at least a year. */
function shotDateOf(fields: ShotFields): string | undefined {
  const entered = shotFrom(fields);
  if (!entered.valid || entered.shot === undefined) {
    return undefined;
  }
  const [year = '', month = '', day = ''] = entered.shot.split('-');
  if (day !== '') {
    const daysInMonth = new Date(
      Date.UTC(Number(year), Number(month), 0),
    ).getUTCDate();
    if (Number(day) > daysInMonth) {
      return undefined;
    }
  }
  return entered.shot;
}

/**
 * What importing the rows would do (D90): the rows to import, in the order
 * given, each numbered from the pattern for its date after the numbers
 * `occupied` already has and those of the rows before it.
 */
export function planned(
  rows: readonly ImportRow[],
  pattern: RollNumberPattern,
  occupied: readonly string[],
): PlannedRow[] {
  const taken = [...occupied];
  return rows.map((row) => {
    const shotDate = row.included ? shotDateOf(row.shot) : undefined;
    const number =
      shotDate === undefined
        ? undefined
        : suggestImportedNumber(
            pattern,
            { shot: shotDate, event: null },
            taken,
          );
    if (number !== undefined) {
      taken.push(number);
    }
    return { ...row, shotDate, number };
  });
}
