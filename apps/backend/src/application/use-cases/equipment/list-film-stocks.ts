import type { FilmStock } from '../../../domain/equipment/film-stock.ts';
import type { ArchiveContext } from '../../../domain/shared/archive-context.ts';
import type { EquipmentRepository } from '../../ports/equipment-repository.ts';

/** Every film stock in the archive, ordered by make and name. */
export class ListFilmStocks {
  readonly #equipment: EquipmentRepository;

  constructor(equipment: EquipmentRepository) {
    this.#equipment = equipment;
  }

  execute(ctx: ArchiveContext): Promise<readonly FilmStock[]> {
    return this.#equipment.listFilmStocks(ctx);
  }
}
