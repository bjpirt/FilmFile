import { publishedTime } from '../sites/published-time.ts';

const minute = 60_000;
const hour = 60 * minute;
const day = 24 * hour;

/**
 * How long ago a sync finished, short enough for the header (FF-226): "just
 * now", "5 min ago", "2 h ago", "3 days ago", and after a week the date ("9
 * Nov", with the year if it isn't this one), in this computer's time zone
 * (or the one given, for tests).
 */
export function syncedAgo(iso: string, now: Date, timeZone?: string): string {
  const ago = now.getTime() - new Date(iso).getTime();
  if (ago < minute) {
    return 'just now';
  }
  if (ago < hour) {
    return `${String(Math.floor(ago / minute))} min ago`;
  }
  if (ago < day) {
    return `${String(Math.floor(ago / hour))} h ago`;
  }
  if (ago < 7 * day) {
    const days = Math.floor(ago / day);
    return `${String(days)} ${days === 1 ? 'day' : 'days'} ago`;
  }
  const date = dateOf(iso, timeZone);
  return date.year === dateOf(now.toISOString(), timeZone).year
    ? `${date.day} ${date.month}`
    : `${date.day} ${date.month} ${date.year}`;
}

/** "9 Nov 2025, 14:02" as its day, month and year. */
function dateOf(iso: string, timeZone?: string) {
  const [day = '', month = '', year = ''] = (
    publishedTime(iso, timeZone).split(',')[0] ?? ''
  ).split(' ');
  return { day, month, year };
}
