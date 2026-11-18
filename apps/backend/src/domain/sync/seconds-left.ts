/** How many bytes had gone up by a time, in milliseconds. */
export interface UploadSample {
  readonly at: number;
  readonly bytes: number;
}

/** How long the speed is judged over, and how long it must have been timed. */
export const timingWindowMs = 60_000;

/**
 * About how many seconds an upload has left (FF-241), from its speed over
 * roughly the last minute, so one big file finishing doesn't swing it. Null
 * until a minute has been timed, or while nothing is moving.
 */
export function secondsLeft(input: {
  /** Oldest first, starting when the upload began. */
  readonly samples: readonly UploadSample[];
  readonly now: number;
  readonly remaining: number;
}): number | null {
  const { samples, now, remaining } = input;
  const latest = samples.at(-1);
  // The newest sample at least a minute old: the speed is judged from there.
  const from = samples.findLast((sample) => sample.at <= now - timingWindowMs);
  if (from === undefined || latest === undefined) {
    return null;
  }
  if (remaining <= 0) {
    return 0;
  }
  const perSecond = (latest.bytes - from.bytes) / ((now - from.at) / 1000);
  return perSecond > 0 ? Math.ceil(remaining / perSecond) : null;
}
