import type { Lens } from '../../../domain/equipment/lens.ts';
import type { ArchiveContext } from '../../../domain/shared/archive-context.ts';
import type { EquipmentRepository } from '../../ports/equipment-repository.ts';

/** Every lens in the archive, ordered by make, name, focal length and aperture. */
export class ListLenses {
  readonly #equipment: EquipmentRepository;

  constructor(equipment: EquipmentRepository) {
    this.#equipment = equipment;
  }

  execute(ctx: ArchiveContext): Promise<readonly Lens[]> {
    return this.#equipment.listLenses(ctx);
  }
}
