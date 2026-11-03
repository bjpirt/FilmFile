import { glob, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { EquipmentRepository } from '../../../application/ports/equipment-repository.ts';
import { cameraLabel, type Camera } from '../../../domain/equipment/camera.ts';
import {
  isEquipmentSlug,
  type EquipmentSlug,
} from '../../../domain/equipment/equipment-slug.ts';
import {
  filmStockLabel,
  type FilmStock,
} from '../../../domain/equipment/film-stock.ts';
import { lensLabel, type Lens } from '../../../domain/equipment/lens.ts';
import type { ArchiveContext } from '../../../domain/shared/archive-context.ts';
import type { AlreadyExists } from '../../../domain/shared/domain-error.ts';
import { err, ok, type Result } from '../../../domain/shared/result.ts';
import { cameraFileContent, parseCameraFile } from './camera-file.ts';
import { hasErrorCode } from './error-codes.ts';
import { filmStockFileContent, parseFilmStockFile } from './film-stock-file.ts';
import { lensFileContent, parseLensFile } from './lens-file.ts';
import { safePath } from './safe-path.ts';
import { createAtomically } from './write-atomically.ts';

/** The folder under `equipment/` for each kind of equipment. */
type Kind = 'cameras' | 'films' | 'lenses';

function byName(a: string, b: string): number {
  // Numbers by value, so ISO 800 comes before 1600.
  return a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true });
}

/**
 * Equipment kept as JSON files in the archive, one per item, named by its
 * slug: `equipment/cameras/<slug>.json`, `equipment/films/<slug>.json` and
 * `equipment/lenses/<slug>.json`.
 */
export class FilesystemEquipmentRepository implements EquipmentRepository {
  readonly #archivePath: string;

  constructor(archivePath: string) {
    this.#archivePath = archivePath;
  }

  #file(kind: Kind, slug: EquipmentSlug): string {
    return safePath(this.#archivePath, 'equipment', kind, `${slug}.json`);
  }

  /** The slugs of every item of a kind: files named as a slug are items. */
  async #slugs(kind: Kind): Promise<EquipmentSlug[]> {
    const slugs: EquipmentSlug[] = [];
    for await (const relative of glob(`equipment/${kind}/*.json`, {
      cwd: this.#archivePath,
    })) {
      const slug = path.basename(relative, '.json');
      if (isEquipmentSlug(slug)) {
        slugs.push(slug);
      }
    }
    return slugs;
  }

  /** An item's file text, or undefined if there's no such item. */
  async #read(kind: Kind, slug: EquipmentSlug): Promise<string | undefined> {
    try {
      return await readFile(this.#file(kind, slug), 'utf8');
    } catch (error) {
      if (hasErrorCode(error, 'ENOENT')) {
        return undefined;
      }
      throw error;
    }
  }

  async #create(
    kind: Kind,
    slug: EquipmentSlug,
    content: string,
  ): Promise<Result<void, AlreadyExists>> {
    await mkdir(safePath(this.#archivePath, 'equipment', kind), {
      recursive: true,
    });
    const created = await createAtomically(this.#file(kind, slug), content);
    return created
      ? ok(undefined)
      : err({ kind: 'already-exists', entity: 'equipment', id: slug });
  }

  async #camera(slug: EquipmentSlug): Promise<Camera | undefined> {
    const text = await this.#read('cameras', slug);
    return text === undefined ? undefined : { slug, ...parseCameraFile(text) };
  }

  async #filmStock(slug: EquipmentSlug): Promise<FilmStock | undefined> {
    const text = await this.#read('films', slug);
    return text === undefined
      ? undefined
      : { slug, ...parseFilmStockFile(text) };
  }

  async #lens(slug: EquipmentSlug): Promise<Lens | undefined> {
    const text = await this.#read('lenses', slug);
    return text === undefined ? undefined : { slug, ...parseLensFile(text) };
  }

  async listCameras(): Promise<readonly Camera[]> {
    const cameras: Camera[] = [];
    for (const slug of await this.#slugs('cameras')) {
      const camera = await this.#camera(slug);
      if (camera !== undefined) {
        cameras.push(camera);
      }
    }
    return cameras.sort((a, b) => byName(cameraLabel(a), cameraLabel(b)));
  }

  getCamera(
    _ctx: ArchiveContext,
    slug: EquipmentSlug,
  ): Promise<Camera | undefined> {
    return this.#camera(slug);
  }

  createCamera(
    _ctx: ArchiveContext,
    camera: Camera,
  ): Promise<Result<void, AlreadyExists>> {
    return this.#create('cameras', camera.slug, cameraFileContent(camera));
  }

  async listFilmStocks(): Promise<readonly FilmStock[]> {
    const films: FilmStock[] = [];
    for (const slug of await this.#slugs('films')) {
      const film = await this.#filmStock(slug);
      if (film !== undefined) {
        films.push(film);
      }
    }
    return films.sort((a, b) => byName(filmStockLabel(a), filmStockLabel(b)));
  }

  getFilmStock(
    _ctx: ArchiveContext,
    slug: EquipmentSlug,
  ): Promise<FilmStock | undefined> {
    return this.#filmStock(slug);
  }

  createFilmStock(
    _ctx: ArchiveContext,
    film: FilmStock,
  ): Promise<Result<void, AlreadyExists>> {
    return this.#create('films', film.slug, filmStockFileContent(film));
  }

  async listLenses(): Promise<readonly Lens[]> {
    const lenses: Lens[] = [];
    for (const slug of await this.#slugs('lenses')) {
      const lens = await this.#lens(slug);
      if (lens !== undefined) {
        lenses.push(lens);
      }
    }
    return lenses.sort((a, b) => byName(lensLabel(a), lensLabel(b)));
  }

  getLens(
    _ctx: ArchiveContext,
    slug: EquipmentSlug,
  ): Promise<Lens | undefined> {
    return this.#lens(slug);
  }

  createLens(
    _ctx: ArchiveContext,
    lens: Lens,
  ): Promise<Result<void, AlreadyExists>> {
    return this.#create('lenses', lens.slug, lensFileContent(lens));
  }
}
