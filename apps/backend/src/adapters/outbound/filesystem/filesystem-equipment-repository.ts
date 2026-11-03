import { glob, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { EquipmentRepository } from '../../../application/ports/equipment-repository.ts';
import type { Camera } from '../../../domain/equipment/camera.ts';
import {
  isEquipmentSlug,
  type EquipmentSlug,
} from '../../../domain/equipment/equipment-slug.ts';
import type { ArchiveContext } from '../../../domain/shared/archive-context.ts';
import type { AlreadyExists } from '../../../domain/shared/domain-error.ts';
import { err, ok, type Result } from '../../../domain/shared/result.ts';
import { cameraFileContent, parseCameraFile } from './camera-file.ts';
import { hasErrorCode } from './error-codes.ts';
import { safePath } from './safe-path.ts';
import { createAtomically } from './write-atomically.ts';

/** Equipment kept as JSON files in the archive: `equipment/cameras/<slug>.json`. */
export class FilesystemEquipmentRepository implements EquipmentRepository {
  readonly #archivePath: string;

  constructor(archivePath: string) {
    this.#archivePath = archivePath;
  }

  #cameraFile(slug: EquipmentSlug): string {
    return safePath(this.#archivePath, 'equipment', 'cameras', `${slug}.json`);
  }

  async listCameras(): Promise<readonly Camera[]> {
    const cameras: Camera[] = [];
    for await (const relative of glob('equipment/cameras/*.json', {
      cwd: this.#archivePath,
    })) {
      const slug = path.basename(relative, '.json');
      // Only files named as a slug are cameras.
      if (isEquipmentSlug(slug)) {
        const camera = await this.#readCamera(slug);
        if (camera !== undefined) {
          cameras.push(camera);
        }
      }
    }
    return cameras.sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
    );
  }

  getCamera(
    _ctx: ArchiveContext,
    slug: EquipmentSlug,
  ): Promise<Camera | undefined> {
    return this.#readCamera(slug);
  }

  async #readCamera(slug: EquipmentSlug): Promise<Camera | undefined> {
    let text: string;
    try {
      text = await readFile(this.#cameraFile(slug), 'utf8');
    } catch (error) {
      if (hasErrorCode(error, 'ENOENT')) {
        return undefined;
      }
      throw error;
    }
    return { slug, ...parseCameraFile(text) };
  }

  async createCamera(
    _ctx: ArchiveContext,
    camera: Camera,
  ): Promise<Result<void, AlreadyExists>> {
    await mkdir(safePath(this.#archivePath, 'equipment', 'cameras'), {
      recursive: true,
    });
    const created = await createAtomically(
      this.#cameraFile(camera.slug),
      cameraFileContent(camera),
    );
    return created
      ? ok(undefined)
      : err({ kind: 'already-exists', entity: 'equipment', id: camera.slug });
  }
}
