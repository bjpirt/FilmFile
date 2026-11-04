import type { Camera } from '../equipment/camera.ts';
import type { FilmStock } from '../equipment/film-stock.ts';
import type { Lens } from '../equipment/lens.ts';
import type { Slug } from '../shared/slug.ts';
import type { ResolvedDetails, Source, Sourced } from './details.ts';

/** A resolved equipment slug with no record, e.g. a camera file deleted by hand. */
export interface Dangling {
  readonly detail: 'camera' | 'film' | 'lens';
  readonly slug: Slug;
  readonly source: Source;
}

/** The equipment a frame was shot with, as records, and any slugs that have none. */
export interface ResolvedEquipment {
  readonly camera?: Sourced<Camera>;
  readonly film?: Sourced<FilmStock>;
  readonly lens?: Sourced<Lens>;
  readonly dangling: readonly Dangling[];
}

/**
 * The resolved camera, film stock and lens as their records, keeping where
 * each came from. A slug with no record is reported, not thrown, so one
 * missing file doesn't hide the rest.
 */
export function resolveEquipment(
  resolved: Pick<ResolvedDetails, 'camera' | 'film' | 'lens'>,
  records: {
    readonly cameras: readonly Camera[];
    readonly films: readonly FilmStock[];
    readonly lenses: readonly Lens[];
  },
): ResolvedEquipment {
  const dangling: Dangling[] = [];

  function find<T extends { readonly slug: Slug }>(
    detail: Dangling['detail'],
    sourced: Sourced<Slug> | undefined,
    list: readonly T[],
  ): Sourced<T> | undefined {
    if (sourced === undefined) {
      return undefined;
    }
    const record = list.find((each) => each.slug === sourced.value);
    if (record === undefined) {
      dangling.push({ detail, slug: sourced.value, source: sourced.source });
      return undefined;
    }
    return { value: record, source: sourced.source };
  }

  const camera = find('camera', resolved.camera, records.cameras);
  const film = find('film', resolved.film, records.films);
  const lens = find('lens', resolved.lens, records.lenses);
  return {
    ...(camera === undefined ? {} : { camera }),
    ...(film === undefined ? {} : { film }),
    ...(lens === undefined ? {} : { lens }),
    dangling,
  };
}
