import { cameraLabel, type Camera } from '../../../domain/equipment/camera.ts';
import { slugFor } from '../../../domain/shared/slug.ts';
import type { ArchiveContext } from '../../../domain/shared/archive-context.ts';
import type {
  AlreadyExists,
  ValidationFailed,
} from '../../../domain/shared/domain-error.ts';
import { err, ok, type Result } from '../../../domain/shared/result.ts';
import type { EquipmentRepository } from '../../ports/equipment-repository.ts';

function required(field: 'make' | 'model'): ValidationFailed {
  return {
    kind: 'validation-failed',
    issues: [{ path: [field], message: 'must not be blank' }],
  };
}

/** Adds a camera, with a slug made from its make and model, e.g. `nikon-fe`. */
export class CreateCamera {
  readonly #equipment: EquipmentRepository;

  constructor(equipment: EquipmentRepository) {
    this.#equipment = equipment;
  }

  async execute(
    ctx: ArchiveContext,
    input: { readonly make: string; readonly model: string },
  ): Promise<Result<Camera, ValidationFailed | AlreadyExists>> {
    const make = input.make.trim();
    const model = input.model.trim();
    if (make === '') {
      return err(required('make'));
    }
    if (model === '') {
      return err(required('model'));
    }
    const slug = slugFor(cameraLabel({ make, model }));
    if (slug === undefined) {
      return err({
        kind: 'validation-failed',
        issues: [{ path: ['model'], message: 'must have a letter or digit' }],
      });
    }
    const camera = { slug, make, model };
    const created = await this.#equipment.createCamera(ctx, camera);
    return created.ok ? ok(camera) : created;
  }
}
