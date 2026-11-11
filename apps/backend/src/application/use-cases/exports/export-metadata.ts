import type { ResolvedDetails } from '../../../domain/details/details.ts';
import type { Camera } from '../../../domain/equipment/camera.ts';
import {
  filmStockLabel,
  type FilmStock,
} from '../../../domain/equipment/film-stock.ts';
import { lensLabel, type Lens } from '../../../domain/equipment/lens.ts';
import type { Event } from '../../../domain/events/event.ts';
import type { Frame, Roll } from '../../../domain/rolls/roll.ts';
import type {
  ImageMetadata,
  MetadataChoice,
} from '../../ports/image-renderer.ts';

/**
 * What an export says about a frame (D94): with `everything`, who it's by,
 * its title and notes, when it was shot (as precisely as it's known), the
 * camera, lens and film, the film and event as keywords, its rating, and
 * where it's from; with `author-and-copyright`, only who it's by. Anything
 * the frame doesn't have is left out, and no location is ever written.
 */
export function exportMetadata(input: {
  readonly choice: MetadataChoice;
  readonly details: ResolvedDetails;
  readonly roll: Roll;
  readonly frame: Frame;
  readonly camera: Camera | undefined;
  readonly lens: Lens | undefined;
  readonly film: FilmStock | undefined;
  readonly event: Event | undefined;
}): ImageMetadata {
  const { details, roll, frame } = input;
  const credit = {
    author: details.author?.value,
    copyright: details.copyright?.value,
  };
  if (input.choice === 'author-and-copyright') {
    return credit;
  }
  const film =
    input.film === undefined ? undefined : filmStockLabel(input.film);
  const keywords = [film, input.event?.name].filter(
    (keyword) => keyword !== undefined,
  );
  return {
    ...credit,
    title: frame.title ?? undefined,
    description: frame.notes ?? undefined,
    shot: details.shot?.value,
    cameraMake: input.camera?.make,
    cameraModel: input.camera?.model,
    lens: input.lens === undefined ? undefined : lensLabel(input.lens),
    film,
    keywords: keywords.length === 0 ? undefined : keywords,
    rating: frame.rating ?? undefined,
    reference:
      frame.number === null ? roll.roll : `${roll.roll} / ${frame.number}`,
  };
}
