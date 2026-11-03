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
 * A date shot as people read it, at the precision it was given:
 * `2026`, `Sep 2026`, `14 Sep 2026` or `14 Sep 2026, 15:30`.
 */
export function formatShot(shot: string): string {
  const [date = '', time] = shot.split('T');
  const [year = '', month, day] = date.split('-');
  const monthName = month === undefined ? undefined : months[Number(month) - 1];
  if (monthName === undefined) {
    return year;
  }
  if (day === undefined) {
    return `${monthName} ${year}`;
  }
  const dated = `${String(Number(day))} ${monthName} ${year}`;
  return time === undefined ? dated : `${dated}, ${time}`;
}
