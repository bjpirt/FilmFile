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
 * When a site was published, as "13 Nov 2026, 14:02" in this computer's
 * time zone (or the one given, for tests). The month names are our own, so
 * no browser's locale data turns "Sep" into "Sept".
 */
export function publishedTime(iso: string, timeZone?: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    ...(timeZone === undefined ? {} : { timeZone }),
  }).formatToParts(new Date(iso));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((found) => found.type === type)?.value ?? '';
  const month = months[Number(part('month')) - 1] ?? '';
  return `${String(Number(part('day')))} ${month} ${part('year')}, ${part('hour')}:${part('minute')}`;
}
