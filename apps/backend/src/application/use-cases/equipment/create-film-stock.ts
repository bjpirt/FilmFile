import { slugFor } from '../../../domain/equipment/equipment-slug.ts';
import {
  filmStockLabel,
  type FilmFormat,
  type FilmStock,
  type FilmType,
} from '../../../domain/equipment/film-stock.ts';
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

/** Adds a film stock, with a slug made from its make, name and speed, e.g. `kodak-portra-400`. */
export class CreateFilmStock {
  readonly #equipment: EquipmentRepository;

  constructor(equipment: EquipmentRepository) {
    this.#equipment = equipment;
  }

  async execute(
    ctx: ArchiveContext,
    input: {
      readonly make: string;
      readonly name: string;
      readonly iso?: number | null | undefined;
      readonly type?: FilmType | null | undefined;
      readonly format?: FilmFormat | null | undefined;
    },
  ): Promise<Result<FilmStock, ValidationFailed | AlreadyExists>> {
    const make = input.make.trim();
    const name = input.name.trim();
    if (make === '') {
      return err(required('make'));
    }
    if (name === '') {
      return err(required('name'));
    }
    const iso = input.iso ?? null;
    const slug = slugFor(filmStockLabel({ make, name, iso }));
    if (slug === undefined) {
      return err({
        kind: 'validation-failed',
        issues: [{ path: ['name'], message: 'must have a letter or digit' }],
      });
    }
    const film: FilmStock = {
      slug,
      make,
      name,
      iso,
      type: input.type ?? null,
      format: input.format ?? null,
    };
    const created = await this.#equipment.createFilmStock(ctx, film);
    return created.ok ? ok(film) : created;
  }
}
