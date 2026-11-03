import type { EquipmentRepository } from '../../../application/ports/equipment-repository.ts';
import type { Camera } from '../../../domain/equipment/camera.ts';
import type { EquipmentSlug } from '../../../domain/equipment/equipment-slug.ts';
import type { ArchiveContext } from '../../../domain/shared/archive-context.ts';
import type { AlreadyExists } from '../../../domain/shared/domain-error.ts';
import { err, ok, type Result } from '../../../domain/shared/result.ts';

/** Equipment kept in memory, for tests. */
export class InMemoryEquipmentRepository implements EquipmentRepository {
  readonly #cameras = new Map<EquipmentSlug, Camera>();

  listCameras(): Promise<readonly Camera[]> {
    return Promise.resolve(
      [...this.#cameras.values()].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
      ),
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
    if (this.#cameras.has(camera.slug)) {
      return Promise.resolve(
        err({ kind: 'already-exists', entity: 'equipment', id: camera.slug }),
      );
    }
    this.#cameras.set(camera.slug, camera);
    return Promise.resolve(ok(undefined));
  }
}
