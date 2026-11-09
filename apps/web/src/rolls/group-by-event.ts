import type { Frame, Roll } from '@filmfile/contracts/rolls';
import { eventsOfFrame } from '../events/frame-events.ts';

/** The frames of a roll that are in one event, or in none (null). */
export interface EventGroup {
  readonly event: string | null;
  readonly frames: readonly Frame[];
}

/**
 * A roll's frames grouped by the event each is in, its own or else the
 * roll's (D50), in the order given (FF-102). Groups come in the order of
 * their first frames, with the frames in no event last. A roll all in one
 * event, or in none, is one group: nothing to group.
 */
export function groupFramesByEvent(
  frames: readonly Frame[],
  roll: Roll,
): EventGroup[] {
  const groups = new Map<string | null, Frame[]>();
  for (const frame of frames) {
    const event = eventsOfFrame(frame, roll)[0] ?? null;
    groups.set(event, [...(groups.get(event) ?? []), frame]);
  }
  const none = groups.get(null);
  groups.delete(null);
  return [
    ...[...groups].map(([event, members]) => ({ event, frames: members })),
    ...(none === undefined ? [] : [{ event: null, frames: none }]),
  ];
}
