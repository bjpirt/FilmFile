import type { Frame, Roll } from '@filmfile/contracts/rolls';

/** The events a frame is in, by slug: its own if it has them (U15), otherwise its roll's. */
export function eventsOfFrame(frame: Frame, roll: Roll): readonly string[] {
  return frame.events ?? (roll.event === null ? [] : [roll.event]);
}

/**
 * The events a roll is in, by slug: its own, then any its frames are in
 * themselves (U17), each once.
 */
export function eventsOfRoll(roll: Roll): readonly string[] {
  return [
    ...new Set([
      ...(roll.event === null ? [] : [roll.event]),
      ...roll.frames.flatMap((frame) => frame.events ?? []),
    ]),
  ];
}
