import type { Frame, Roll } from '@filmfile/contracts/rolls';

/**
 * What a frame has of its own, in words: the details that differ from its
 * roll's (U15, U59) and whether it has notes (U29), as "Its own camera and
 * lens", "Has notes" or "Its own lens, and notes". Undefined when it has
 * neither (U69, D49).
 */
export function ownDetails(frame: Frame, roll: Roll): string | undefined {
  const rollEvents = roll.event === null ? [] : [roll.event];
  const own = [
    frame.camera !== null && frame.camera !== roll.camera ? 'camera' : '',
    frame.lens !== null && frame.lens !== roll.lens ? 'lens' : '',
    frame.events !== null && frame.events.join(' ') !== rollEvents.join(' ')
      ? 'events'
      : '',
    frame.shot !== null && frame.shot !== roll.shot ? 'date' : '',
  ].filter((detail) => detail !== '');
  const notes = (frame.notes ?? '').trim() !== '';
  if (own.length === 0) {
    return notes ? 'Has notes' : undefined;
  }
  const last = own.at(-1) ?? '';
  const rest = own.slice(0, -1);
  const details = `Its own ${rest.length === 0 ? last : `${rest.join(', ')} and ${last}`}`;
  return notes ? `${details}, and notes` : details;
}
