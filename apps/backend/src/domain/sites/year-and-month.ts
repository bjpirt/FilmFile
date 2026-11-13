/**
 * The year and month in a date written for reading (`shotLabel`: "14 Sep
 * 2026", "Sep 2026", "2026"); either is absent when the date doesn't have it.
 */
export function yearAndMonth(date: string | undefined): {
  readonly year?: string;
  readonly month?: string;
} {
  const words = date?.split(' ') ?? [];
  const year = words.at(-1);
  const month = words.at(-2);
  return {
    ...(year !== undefined && /^\d{4}$/.test(year) ? { year } : {}),
    ...(month === undefined ? {} : { month }),
  };
}
