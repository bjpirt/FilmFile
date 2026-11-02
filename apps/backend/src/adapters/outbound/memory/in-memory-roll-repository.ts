import type {
  RollListing,
  RollRepository,
} from '../../../application/ports/roll-repository.ts';
import type { Roll } from '../../../domain/rolls/roll.ts';
import type { ArchiveContext } from '../../../domain/shared/archive-context.ts';
import type {
  AlreadyExists,
  NotFound,
} from '../../../domain/shared/domain-error.ts';
import type { RollId } from '../../../domain/shared/ids.ts';
import { err, ok, type Result } from '../../../domain/shared/result.ts';

/** Rolls kept in memory, for tests. */
export class InMemoryRollRepository implements RollRepository {
  readonly #rolls = new Map<RollId, Roll>();

  list(): Promise<RollListing> {
    const rolls = [...this.#rolls.values()].sort((a, b) =>
      a.roll.localeCompare(b.roll),
    );
    return Promise.resolve({ rolls, unreadable: [] });
  }

  get(_ctx: ArchiveContext, id: RollId): Promise<Roll | undefined> {
    return Promise.resolve(this.#rolls.get(id));
  }

  create(
    _ctx: ArchiveContext,
    roll: Roll,
  ): Promise<Result<void, AlreadyExists>> {
    if ([...this.#rolls.values()].some((r) => r.roll === roll.roll)) {
      return Promise.resolve(
        err({ kind: 'already-exists', entity: 'roll', id: roll.roll }),
      );
    }
    this.#rolls.set(roll.id, roll);
    return Promise.resolve(ok(undefined));
  }

  save(_ctx: ArchiveContext, roll: Roll): Promise<Result<void, NotFound>> {
    if (!this.#rolls.has(roll.id)) {
      return Promise.resolve(
        err({ kind: 'not-found', entity: 'roll', id: roll.id }),
      );
    }
    this.#rolls.set(roll.id, roll);
    return Promise.resolve(ok(undefined));
  }
}
