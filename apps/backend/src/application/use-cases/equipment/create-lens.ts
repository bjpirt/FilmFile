import { slugFor } from '../../../domain/equipment/equipment-slug.ts';
import { lensLabel, type Lens } from '../../../domain/equipment/lens.ts';
import type { ArchiveContext } from '../../../domain/shared/archive-context.ts';
import type {
  AlreadyExists,
  ValidationFailed,
} from '../../../domain/shared/domain-error.ts';
import { err, ok, type Result } from '../../../domain/shared/result.ts';
import type { EquipmentRepository } from '../../ports/equipment-repository.ts';

function required(field: 'make' | 'name'): ValidationFailed {
  return {
    kind: 'validation-failed',
    issues: [{ path: [field], message: 'must not be blank' }],
  };
}

/**
 * Adds a lens, with a slug made from its make, name, focal length and
 * aperture, e.g. `nikon-nikkor-ai-s-50mm-f-1-8`.
 */
export class CreateLens {
  readonly #equipment: EquipmentRepository;

  constructor(equipment: EquipmentRepository) {
    this.#equipment = equipment;
  }

  async execute(
    ctx: ArchiveContext,
    input: {
      readonly make: string;
      readonly name: string;
      readonly focalLength?: number | null | undefined;
      readonly maxAperture?: number | null | undefined;
    },
  ): Promise<Result<Lens, ValidationFailed | AlreadyExists>> {
    const make = input.make.trim();
    const name = input.name.trim();
    if (make === '') {
      return err(required('make'));
    }
    if (name === '') {
      return err(required('name'));
    }
    const details = {
      make,
      name,
      focalLength: input.focalLength ?? null,
      maxAperture: input.maxAperture ?? null,
    };
    const slug = slugFor(lensLabel(details));
    if (slug === undefined) {
      return err({
        kind: 'validation-failed',
        issues: [{ path: ['name'], message: 'must have a letter or digit' }],
      });
    }
    const lens: Lens = { slug, ...details };
    const created = await this.#equipment.createLens(ctx, lens);
    return created.ok ? ok(lens) : created;
  }
}
