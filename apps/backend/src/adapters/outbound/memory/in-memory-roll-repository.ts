import type {
  RollChange,
  RollListing,
  RollRepository,
  VersionedRoll,
} from '../../../application/ports/roll-repository.ts';
import type { Roll } from '../../../domain/rolls/roll.ts';
import type { ArchiveContext } from '../../../domain/shared/archive-context.ts';
import type {
  AlreadyExists,
  ConcurrencyConflict,
  NotFound,
} from '../../../domain/shared/domain-error.ts';
import type { RollId } from '../../../domain/shared/ids.ts';
import { err, ok, type Result } from '../../../domain/shared/result.ts';
import { KeyedLock } from '../node/keyed-lock.ts';

/** `save` and `change` never change a roll's number: that's `saveRenumbered`'s (D70). */
function sameNumber(before: Roll, after: Roll): void {
  if (before.roll !== after.roll) {
    throw new Error(
      `roll ${before.id} was saved with another number: a number is changed with saveRenumbered`,
    );
  }
}

/** Rolls kept in memory, for tests. Versions count up from 1 per save. */
export class InMemoryRollRepository implements RollRepository {
  readonly #rolls = new Map<RollId, VersionedRoll>();
  readonly #lock = new KeyedLock();
  #saves = 0;

  #store(roll: Roll): string {
    this.#saves += 1;
    const version = String(this.#saves);
    this.#rolls.set(roll.id, { roll, version });
    return version;
  }

  list(): Promise<RollListing> {
    const rolls = [...this.#rolls.values()]
      .map((r) => r.roll)
      .sort((a, b) => a.roll.localeCompare(b.roll));
    return Promise.resolve({ rolls, unreadable: [] });
  }

  get(_ctx: ArchiveContext, id: RollId): Promise<VersionedRoll | undefined> {
    return Promise.resolve(this.#rolls.get(id));
  }

  create(
    _ctx: ArchiveContext,
    roll: Roll,
  ): Promise<Result<void, AlreadyExists>> {
    if ([...this.#rolls.values()].some((r) => r.roll.roll === roll.roll)) {
      return Promise.resolve(
        err({ kind: 'already-exists', entity: 'roll', id: roll.roll }),
      );
    }
    this.#store(roll);
    return Promise.resolve(ok(undefined));
  }

  save(
    _ctx: ArchiveContext,
    roll: Roll,
    expectedVersion: string,
  ): Promise<Result<string, NotFound | ConcurrencyConflict>> {
    return this.#lock.run(roll.id, () => {
      const current = this.#rolls.get(roll.id);
      let result: Result<string, NotFound | ConcurrencyConflict>;
      if (current === undefined) {
        result = err({ kind: 'not-found', entity: 'roll', id: roll.id });
      } else if (current.version !== expectedVersion) {
        result = err({
          kind: 'concurrency-conflict',
          entity: 'roll',
          id: roll.id,
        });
      } else {
        sameNumber(current.roll, roll);
        result = ok(this.#store(roll));
      }
      return Promise.resolve(result);
    });
  }

  saveRenumbered(
    _ctx: ArchiveContext,
    roll: Roll,
    expectedVersion: string,
  ): Promise<Result<string, NotFound | ConcurrencyConflict | AlreadyExists>> {
    // One at a time across rolls, so two can't both take a number.
    return this.#lock.run('numbers', () => {
      const current = this.#rolls.get(roll.id);
      let result: Result<
        string,
        NotFound | ConcurrencyConflict | AlreadyExists
      >;
      if (current === undefined) {
        result = err({ kind: 'not-found', entity: 'roll', id: roll.id });
      } else if (current.version !== expectedVersion) {
        result = err({
          kind: 'concurrency-conflict',
          entity: 'roll',
          id: roll.id,
        });
      } else if (
        [...this.#rolls.values()].some(
          (r) => r.roll.id !== roll.id && r.roll.roll === roll.roll,
        )
      ) {
        result = err({ kind: 'already-exists', entity: 'roll', id: roll.roll });
      } else {
        result = ok(this.#store(roll));
      }
      return Promise.resolve(result);
    });
  }

  change<T, E>(
    _ctx: ArchiveContext,
    id: RollId,
    apply: (roll: Roll) => Promise<Result<RollChange<T>, E>>,
  ): Promise<Result<T, E | NotFound>> {
    return this.#lock.run(id, async () => {
      const current = this.#rolls.get(id);
      if (current === undefined) {
        return err({ kind: 'not-found', entity: 'roll', id });
      }
      const changed = await apply(current.roll);
      if (!changed.ok) {
        return changed;
      }
      sameNumber(current.roll, changed.value.roll);
      this.#store(changed.value.roll);
      return ok(changed.value.value);
    });
  }

  remove(
    _ctx: ArchiveContext,
    id: RollId,
    expectedVersion: string,
    handOver: (roll: Roll) => Promise<void>,
  ): Promise<Result<void, NotFound | ConcurrencyConflict>> {
    return this.#lock.run(id, async () => {
      const current = this.#rolls.get(id);
      if (current === undefined) {
        return err({ kind: 'not-found', entity: 'roll', id });
      }
      if (current.version !== expectedVersion) {
        return err({ kind: 'concurrency-conflict', entity: 'roll', id });
      }
      this.#rolls.delete(id);
      await handOver(current.roll);
      return ok(undefined);
    });
  }
}
