import type { Camera } from '../../../domain/equipment/camera.ts';
import type { ArchiveContext } from '../../../domain/shared/archive-context.ts';
import type { EquipmentRepository } from '../../ports/equipment-repository.ts';

/** Every camera in the archive, ordered by make and model. */
export class ListCameras {
  readonly #equipment: EquipmentRepository;

  constructor(equipment: EquipmentRepository) {
    this.#equipment = equipment;
  }

  execute(ctx: ArchiveContext): Promise<readonly Camera[]> {
    return this.#equipment.listCameras(ctx);
  }
}
