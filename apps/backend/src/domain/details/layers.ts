import type { Archive } from '../archive/archive.ts';
import type { Roll } from '../rolls/roll.ts';
import type { DetailsLayer } from './details.ts';

// The layers a frame's details are resolved from. A detail a record doesn't
// have is left out, so it's inherited rather than cleared.

/** The archive's author and copyright, the most general layer. */
export function archiveLayer(archive: Archive): DetailsLayer {
  return {
    source: { layer: 'archive', id: archive.id },
    details: {
      author: archive.author,
      ...(archive.copyright === null ? {} : { copyright: archive.copyright }),
    },
  };
}

/** A roll's camera, film stock, lens and event. */
export function rollLayer(
  roll: Pick<Roll, 'id' | 'camera' | 'film' | 'lens' | 'event'>,
): DetailsLayer {
  return {
    source: { layer: 'roll', id: roll.id },
    details: {
      ...(roll.camera === null ? {} : { camera: roll.camera }),
      ...(roll.film === null ? {} : { film: roll.film }),
      ...(roll.lens === null ? {} : { lens: roll.lens }),
      ...(roll.event === null ? {} : { events: [roll.event] }),
    },
  };
}
