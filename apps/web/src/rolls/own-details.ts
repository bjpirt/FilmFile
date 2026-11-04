import type { Frame, Roll } from '@filmfile/contracts/rolls';

/**
 * Which details a frame has of its own, where they differ from its roll's,
 * in words: "Its own camera and lens". Undefined when it has none (U15).
 */
export function ownDetails(frame: Frame, roll: Roll): string | undefined {
  const rollEvents = roll.event === null ? [] : [roll.event];
  const own = [
    frame.camera !== null && frame.camera !== roll.camera ? 'camera' : '',
    frame.lens !== null && frame.lens !== roll.lens ? 'lens' : '',
    frame.events !== null && frame.events.join(' ') !== rollEvents.join(' ')
      ? 'events'
      : '',
  ].filter((detail) => detail !== '');
  if (own.length === 0) {
    return undefined;
  }
  const last = own.at(-1) ?? '';
  const rest = own.slice(0, -1);
  return `Its own ${rest.length === 0 ? last : `${rest.join(', ')} and ${last}`}`;
}
