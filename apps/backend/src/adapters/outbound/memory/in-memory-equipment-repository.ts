import type { EquipmentRepository } from '../../../application/ports/equipment-repository.ts';
import type { Camera } from '../../../domain/equipment/camera.ts';
import type { EquipmentSlug } from '../../../domain/equipment/equipment-slug.ts';
import {
  filmStockLabel,
  type FilmStock,
} from '../../../domain/equipment/film-stock.ts';
import type { ArchiveContext } from '../../../domain/shared/archive-context.ts';
import type { AlreadyExists } from '../../../domain/shared/domain-error.ts';
import { err, ok, type Result } from '../../../domain/shared/result.ts';

function byName(a: string, b: string): number {
  // Numbers by value, so ISO 800 comes before 1600.
  return a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true });
}

/** Adds an item to a map by its slug, unless one is there already. */
function added<T extends { readonly slug: EquipmentSlug }>(
  items: Map<EquipmentSlug, T>,
  item: T,
): Promise<Result<void, AlreadyExists>> {
  if (items.has(item.slug)) {
    return Promise.resolve(
      err({ kind: 'already-exists', entity: 'equipment', id: item.slug }),
    );
  }
  items.set(item.slug, item);
  return Promise.resolve(ok(undefined));
}

/** Equipment kept in memory, for tests. */
export class InMemoryEquipmentRepository implements EquipmentRepository {
  readonly #cameras = new Map<EquipmentSlug, Camera>();
  readonly #films = new Map<EquipmentSlug, FilmStock>();

  listCameras(): Promise<readonly Camera[]> {
    return Promise.resolve(
      [...this.#cameras.values()].sort((a, b) => byName(a.name, b.name)),
    );
  }

  getCamera(
    _ctx: ArchiveContext,
    slug: EquipmentSlug,
  ): Promise<Camera | undefined> {
    return Promise.resolve(this.#cameras.get(slug));
  }

  createCamera(
    _ctx: ArchiveContext,
    camera: Camera,
  ): Promise<Result<void, AlreadyExists>> {
    return added(this.#cameras, camera);
  }

  listFilmStocks(): Promise<readonly FilmStock[]> {
    return Promise.resolve(
      [...this.#films.values()].sort((a, b) =>
        byName(filmStockLabel(a), filmStockLabel(b)),
      ),
    );
  }

  getFilmStock(
    _ctx: ArchiveContext,
    slug: EquipmentSlug,
  ): Promise<FilmStock | undefined> {
    return Promise.resolve(this.#films.get(slug));
  }

  createFilmStock(
    _ctx: ArchiveContext,
    film: FilmStock,
  ): Promise<Result<void, AlreadyExists>> {
    return added(this.#films, film);
  }
}
