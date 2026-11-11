import type { Frame, Roll } from '@filmfile/contracts/rolls';

/**
 * The event a frame is in: its own if set (U15), none if it's marked as in no
 * event (D98), otherwise its roll's.
 */
export function eventsOfFrame(frame: Frame, roll: Roll): readonly string[] {
  const event = frame.event ?? roll.event;
  return event === null || event === false ? [] : [event];
}

/**
 * The events a roll is in, by slug: its own, then any its frames are in
 * themselves (U17), each once.
 */
export function eventsOfRoll(roll: Roll): readonly string[] {
  return [
    ...new Set([
      ...(roll.event === null ? [] : [roll.event]),
      // A hidden frame doesn't put its roll in an event (D99).
      ...roll.frames.flatMap((frame) =>
        frame.hidden || frame.event === null || frame.event === false
          ? []
          : [frame.event],
      ),
    ]),
  ];
}
