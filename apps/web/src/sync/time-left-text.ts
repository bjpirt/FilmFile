/**
 * About how long a sync has left, in words (FF-241): "Less than a minute
 * left", "About 5 min left" under an hour, and "About 2 h left" above.
 */
export function timeLeftText(seconds: number): string {
  if (seconds < 60) {
    return 'Less than a minute left';
  }
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `About ${String(minutes)} min left`;
  }
  return `About ${String(Math.round(seconds / 3600))} h left`;
}
