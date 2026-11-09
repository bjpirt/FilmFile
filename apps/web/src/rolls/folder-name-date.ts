/** The date shot a roll's folder name gives, as parts: a year, and a month and day when it has them. */
export interface NameDate {
  readonly year: string;
  readonly month: string;
  readonly day: string;
}

/** Days in a month of a year, with February's by leap year. */
function daysIn(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

// A whole year of 19nn or 20nn, not part of a longer number, then optionally
// a month and a day, each with a `-`, `_` or `.` before it or none:
// `2019 Iceland`, `2024-08 Iceland`, `20240812`, `2024_08_12 Iceland`.
const dated =
  /(?<!\d)((?:19|20)\d{2})(?:[-_.]?(0[1-9]|1[0-2])(?:[-_.]?(0[1-9]|[12]\d|3[01]))?)?(?!\d)/u;

/**
 * The date a roll's folder name gives (FF-154, D90): its first whole year,
 * with a month and day when the name has them and they're a real date, else
 * `undefined` for a name with no year in it.
 */
export function dateInFolderName(name: string): NameDate | undefined {
  const found = dated.exec(name);
  const year = found?.[1];
  if (year === undefined) {
    return undefined;
  }
  const month = found?.[2] ?? '';
  const day = found?.[3] ?? '';
  // A day the month hasn't (02-30) is left out, keeping the month.
  const real = day !== '' && Number(day) <= daysIn(Number(year), Number(month));
  return { year, month, day: real ? day : '' };
}
