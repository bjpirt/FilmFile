import type { ShotDate } from '../rolls/shot-date.ts';
import type { Slug } from '../shared/slug.ts';
import type {
  DetailsLayer,
  ResolvedDetails,
  Source,
  Sourced,
} from './details.ts';

/** A scalar detail as a layer leaves it: replaced, cleared by null, or inherited if left out. */
function scalar<T>(
  inherited: Sourced<T> | undefined,
  set: T | null | undefined,
  source: Source,
): Sourced<T> | undefined {
  if (set === undefined) {
    return inherited;
  }
  return set === null ? undefined : { value: set, source };
}

/**
 * The details a frame ends up with, from its layers in order, general to
 * specific (design section 6): a scalar replaces the one inherited, or null
 * clears it. Each value says which layer set it last.
 */
export function resolveDetails(
  layers: readonly DetailsLayer[],
): ResolvedDetails {
  let author: Sourced<string> | undefined;
  let copyright: Sourced<string> | undefined;
  let camera: Sourced<Slug> | undefined;
  let film: Sourced<Slug> | undefined;
  let lens: Sourced<Slug> | undefined;
  let event: Sourced<Slug> | undefined;
  let shot: Sourced<ShotDate> | undefined;
  for (const { source, details } of layers) {
    author = scalar(author, details.author, source);
    copyright = scalar(copyright, details.copyright, source);
    camera = scalar(camera, details.camera, source);
    film = scalar(film, details.film, source);
    lens = scalar(lens, details.lens, source);
    event = scalar(event, details.event, source);
    shot = scalar(shot, details.shot, source);
  }
  // Only the details that are set.
  return {
    ...(author === undefined ? {} : { author }),
    ...(copyright === undefined ? {} : { copyright }),
    ...(camera === undefined ? {} : { camera }),
    ...(film === undefined ? {} : { film }),
    ...(lens === undefined ? {} : { lens }),
    ...(event === undefined ? {} : { event }),
    ...(shot === undefined ? {} : { shot }),
  };
}
