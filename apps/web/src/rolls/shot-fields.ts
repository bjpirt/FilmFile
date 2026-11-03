/** The date shot as entered: each part as typed, empty when not given. */
export interface ShotFields {
  readonly year: string;
  readonly month: string;
  readonly day: string;
  readonly time: string;
}

/** The date shot to send, if any, or that what was entered can't be one. */
export type EnteredShot =
  | { readonly valid: true; readonly shot: string | undefined }
  | { readonly valid: false };

/**
 * The date shot to send, e.g. `2026-09-14T06:30`: as precise as the parts
 * given, each needing the one before it. No date when nothing is given;
 * not valid when the year isn't four digits.
 */
export function shotFrom(fields: ShotFields): EnteredShot {
  const { year, month, day, time } = fields;
  if ([year, month, day, time].every((part) => part === '')) {
    return { valid: true, shot: undefined };
  }
  if (!/^\d{4}$/.test(year)) {
    return { valid: false };
  }
  if (month === '') {
    return { valid: true, shot: year };
  }
  if (day === '') {
    return { valid: true, shot: `${year}-${month}` };
  }
  const date = `${year}-${month}-${day.padStart(2, '0')}`;
  return { valid: true, shot: time === '' ? date : `${date}T${time}` };
}

/** The fields for a date shot, as precise as it is: e.g. `2026-09` gives a year and month. */
export function shotFieldsOf(shot: string | null): ShotFields {
  const [date = '', time = ''] = (shot ?? '').split('T');
  const [year = '', month = '', day = ''] = date.split('-');
  return { year, month, day, time };
}
