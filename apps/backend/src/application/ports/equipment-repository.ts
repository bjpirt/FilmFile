import type { Camera } from '../../domain/equipment/camera.ts';
import type { FilmStock } from '../../domain/equipment/film-stock.ts';
import type { Lens } from '../../domain/equipment/lens.ts';
import type { Slug } from '../../domain/shared/slug.ts';
import type { ArchiveContext } from '../../domain/shared/archive-context.ts';
import type { AlreadyExists } from '../../domain/shared/domain-error.ts';
import type { Result } from '../../domain/shared/result.ts';

/**
 * Where the archive's equipment is kept: a JSON file per camera, film stock
 * and lens in the archive, or memory in tests. Equipment is found by its slug.
 */
export interface EquipmentRepository {
  /** Every camera, ordered by make and model. */
  listCameras(ctx: ArchiveContext): Promise<readonly Camera[]>;

  getCamera(ctx: ArchiveContext, slug: Slug): Promise<Camera | undefined>;

  /** Adds a new camera; fails if another camera has its slug. */
  createCamera(
    ctx: ArchiveContext,
    camera: Camera,
  ): Promise<Result<void, AlreadyExists>>;

  /** Every film stock, ordered by make and name. */
  listFilmStocks(ctx: ArchiveContext): Promise<readonly FilmStock[]>;

  getFilmStock(ctx: ArchiveContext, slug: Slug): Promise<FilmStock | undefined>;

  /** Adds a new film stock; fails if another film stock has its slug. */
  createFilmStock(
    ctx: ArchiveContext,
    film: FilmStock,
  ): Promise<Result<void, AlreadyExists>>;

  /** Every lens, ordered by make, name, focal length and aperture. */
  listLenses(ctx: ArchiveContext): Promise<readonly Lens[]>;

  getLens(ctx: ArchiveContext, slug: Slug): Promise<Lens | undefined>;

  /** Adds a new lens; fails if another lens has its slug. */
  createLens(
    ctx: ArchiveContext,
    lens: Lens,
  ): Promise<Result<void, AlreadyExists>>;
}
