const months = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/**
 * A shot date or event date written for reading, as precisely as it's known:
 * `2026-09-14T15:30` → "14 Sep 2026", `2026-09` → "Sep 2026", `2026` → "2026".
 * The time is left out: a gallery doesn't need it.
 */
export function shotLabel(date: string): string {
  const [year = '', month, day] = date.slice(0, 10).split('-');
  const monthName = months[Number(month) - 1];
  if (monthName === undefined) {
    return year;
  }
  return day === undefined
    ? `${monthName} ${year}`
    : `${String(Number(day))} ${monthName} ${year}`;
}
