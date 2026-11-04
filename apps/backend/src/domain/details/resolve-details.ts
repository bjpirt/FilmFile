import type { Slug } from '../shared/slug.ts';
import type {
  DetailsLayer,
  ListChange,
  ResolvedDetails,
  Source,
  Sourced,
} from './details.ts';

function isList<T>(change: ListChange<T>): change is readonly T[] {
  return Array.isArray(change);
}

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

/** A list detail as a layer leaves it: replaced, added to and taken from, cleared by null, or inherited. */
function list<T>(
  inherited: Sourced<readonly T[]> | undefined,
  change: ListChange<T> | null | undefined,
  source: Source,
): Sourced<readonly T[]> | undefined {
  if (change === undefined) {
    return inherited;
  }
  if (change === null) {
    return undefined;
  }
  if (isList(change)) {
    return { value: change, source };
  }
  const { add = [], remove = [] } = change;
  const kept = (inherited?.value ?? []).filter(
    (item) => !remove.includes(item),
  );
  return {
    value: [...kept, ...add.filter((item) => !kept.includes(item))],
    source,
  };
}

/**
 * The details a frame ends up with, from its layers in order, general to
 * specific (design section 6): a scalar replaces the one inherited, a list
 * replaces it or changes it with `{ add, remove }`, and null clears either.
 * Each value says which layer set it last.
 */
export function resolveDetails(
  layers: readonly DetailsLayer[],
): ResolvedDetails {
  let author: Sourced<string> | undefined;
  let copyright: Sourced<string> | undefined;
  let camera: Sourced<Slug> | undefined;
  let film: Sourced<Slug> | undefined;
  let lens: Sourced<Slug> | undefined;
  let events: Sourced<readonly Slug[]> | undefined;
  for (const { source, details } of layers) {
    author = scalar(author, details.author, source);
    copyright = scalar(copyright, details.copyright, source);
    camera = scalar(camera, details.camera, source);
    film = scalar(film, details.film, source);
    lens = scalar(lens, details.lens, source);
    events = list(events, details.events, source);
  }
  // Only the details that are set.
  return {
    ...(author === undefined ? {} : { author }),
    ...(copyright === undefined ? {} : { copyright }),
    ...(camera === undefined ? {} : { camera }),
    ...(film === undefined ? {} : { film }),
    ...(lens === undefined ? {} : { lens }),
    ...(events === undefined ? {} : { events }),
  };
}
