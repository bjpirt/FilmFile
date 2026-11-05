import type { Settings } from '../settings/settings.ts';
import type { Frame, Roll } from '../rolls/roll.ts';
import type { DetailsLayer } from './details.ts';

// The layers a frame's details are resolved from. A detail a record doesn't
// have is left out, so it's inherited rather than cleared.

/** The archive-wide author and copyright, the most general layer. */
export function archiveLayer(settings: Settings): DetailsLayer {
  return {
    source: { layer: 'archive', id: settings.id },
    details: {
      author: settings.author,
      ...(settings.copyright === null ? {} : { copyright: settings.copyright }),
    },
  };
}

/** A roll's camera, film stock, lens, event and date shot. */
export function rollLayer(
  roll: Pick<Roll, 'id' | 'camera' | 'film' | 'lens' | 'event' | 'shot'>,
): DetailsLayer {
  return {
    source: { layer: 'roll', id: roll.id },
    details: {
      ...(roll.camera === null ? {} : { camera: roll.camera }),
      ...(roll.film === null ? {} : { film: roll.film }),
      ...(roll.lens === null ? {} : { lens: roll.lens }),
      ...(roll.event === null ? {} : { events: [roll.event] }),
      ...(roll.shot === null ? {} : { shot: roll.shot }),
    },
  };
}

/** A frame's own camera, lens, events and date shot, the most specific layer (U15, D47); never a film stock (D45). */
export function frameLayer(
  frame: Pick<Frame, 'id' | 'camera' | 'lens' | 'events' | 'shot'>,
): DetailsLayer {
  return {
    source: { layer: 'frame', id: frame.id },
    details: {
      ...(frame.camera === null ? {} : { camera: frame.camera }),
      ...(frame.lens === null ? {} : { lens: frame.lens }),
      ...(frame.events === null ? {} : { events: frame.events }),
      ...(frame.shot === null ? {} : { shot: frame.shot }),
    },
  };
}
