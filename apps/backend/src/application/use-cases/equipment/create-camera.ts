import type { Camera } from '../../../domain/equipment/camera.ts';
import { slugFor } from '../../../domain/equipment/equipment-slug.ts';
import type { ArchiveContext } from '../../../domain/shared/archive-context.ts';
import type {
  AlreadyExists,
  ValidationFailed,
} from '../../../domain/shared/domain-error.ts';
import { err, ok, type Result } from '../../../domain/shared/result.ts';
import type { EquipmentRepository } from '../../ports/equipment-repository.ts';

/** Adds a camera, named as given, with a slug made from its name. */
export class CreateCamera {
  readonly #equipment: EquipmentRepository;

  constructor(equipment: EquipmentRepository) {
    this.#equipment = equipment;
  }

  async execute(
    ctx: ArchiveContext,
    input: { readonly name: string },
  ): Promise<Result<Camera, ValidationFailed | AlreadyExists>> {
    const name = input.name.trim();
    const slug = slugFor(name);
    if (slug === undefined) {
      return err({
        kind: 'validation-failed',
        issues: [{ path: ['name'], message: 'must have a letter or digit' }],
      });
    }
    const camera = { slug, name };
    const created = await this.#equipment.createCamera(ctx, camera);
    return created.ok ? ok(camera) : created;
  }
}
