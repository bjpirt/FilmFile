import type {
  RollChange,
  RollListing,
  RollRepository,
  VersionedRoll,
  VersionedRollListing,
} from '../../../application/ports/roll-repository.ts';
import { planRollRenumbering } from '../../../domain/rolls/plan-roll-renumbering.ts';
import {
  filedRollNumberMessage,
  mayChangeRollNumber,
} from '../../../domain/rolls/roll-number-change.ts';
import {
  compareRollNumbers,
  sameRollNumber,
} from '../../../domain/rolls/roll-number.ts';
import type { Roll } from '../../../domain/rolls/roll.ts';
import type { ArchiveContext } from '../../../domain/shared/archive-context.ts';
import type {
  AlreadyExists,
  ConcurrencyConflict,
  NotFound,
  ValidationFailed,
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
  // The one lock, as in the filesystem repository: every roll change takes its
  // turn on it, so two can't both take a number (D77).
  readonly #archive = new KeyedLock();
  #saves = 0;

  #store(roll: Roll): string {
    this.#saves += 1;
    const version = String(this.#saves);
    this.#rolls.set(roll.id, { roll, version });
    return version;
  }

  async list(ctx: ArchiveContext): Promise<RollListing> {
    const listing = await this.listVersioned(ctx);
    return {
      rolls: listing.rolls.map(({ roll }) => roll),
      unreadable: listing.unreadable,
    };
  }

  // This adapter is already bound to its archive; the port keeps context on every operation.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- see above
  listVersioned(_ctx: ArchiveContext): Promise<VersionedRollListing> {
    const rolls = [...this.#rolls.values()].sort((a, b) =>
      compareRollNumbers(a.roll.roll, b.roll.roll),
    );
    return Promise.resolve({ rolls, unreadable: [] });
  }

  get(_ctx: ArchiveContext, id: RollId): Promise<VersionedRoll | undefined> {
    return Promise.resolve(this.#rolls.get(id));
  }

  create(
    _ctx: ArchiveContext,
    roll: Roll,
  ): Promise<Result<void, AlreadyExists>> {
    return this.#archive.run<Result<void, AlreadyExists>>('archive', () => {
      if (
        [...this.#rolls.values()].some((r) =>
          sameRollNumber(r.roll.roll, roll.roll),
        )
      ) {
        return Promise.resolve(
          err({ kind: 'already-exists', entity: 'roll', id: roll.roll }),
        );
      }
      this.#store(roll);
      return Promise.resolve(ok(undefined));
    });
  }

  save(
    _ctx: ArchiveContext,
    roll: Roll,
    expectedVersion: string,
  ): Promise<Result<string, NotFound | ConcurrencyConflict>> {
    return this.#archive.run('archive', () => {
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
  ): Promise<
    Result<
      string,
      NotFound | ConcurrencyConflict | AlreadyExists | ValidationFailed
    >
  > {
    return this.#archive.run('archive', () => {
      const current = this.#rolls.get(roll.id);
      let result: Result<
        string,
        NotFound | ConcurrencyConflict | AlreadyExists | ValidationFailed
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
        !mayChangeRollNumber(current.roll) &&
        current.roll.roll !== roll.roll
      ) {
        result = err({
          kind: 'validation-failed',
          issues: [{ path: ['roll'], message: filedRollNumberMessage }],
        });
      } else if (
        [...this.#rolls.values()].some(
          (r) =>
            r.roll.id !== roll.id && sameRollNumber(r.roll.roll, roll.roll),
        )
      ) {
        result = err({
          kind: 'already-exists',
          entity: 'roll',
          id: roll.roll,
        });
      } else {
        result = ok(this.#store(roll));
      }
      return Promise.resolve(result);
    });
  }

  saveRenumberedBatch(
    _ctx: ArchiveContext,
    expected: readonly { readonly id: RollId; readonly version: string }[],
    unreadable: readonly {
      readonly folder: string;
      readonly problem: string;
    }[],
    changes: readonly {
      readonly id: RollId;
      readonly roll: Roll['roll'];
    }[],
  ): Promise<
    Result<void, AlreadyExists | ConcurrencyConflict | ValidationFailed>
  > {
    return this.#archive.run<
      Result<void, AlreadyExists | ConcurrencyConflict | ValidationFailed>
    >('archive', () => {
      const planned = planRollRenumbering({
        current: [...this.#rolls.values()],
        currentUnreadable: [],
        expected,
        expectedUnreadable: unreadable,
        changes,
      });
      if (!planned.ok) {
        return Promise.resolve(planned);
      }
      for (const change of planned.value) {
        const found = this.#rolls.get(change.id);
        if (found !== undefined) {
          this.#store({ ...found.roll, roll: change.roll });
        }
      }
      return Promise.resolve(ok(undefined));
    });
  }

  change<T, E>(
    _ctx: ArchiveContext,
    id: RollId,
    apply: (roll: Roll) => Promise<Result<RollChange<T>, E>>,
  ): Promise<Result<T, E | NotFound>> {
    return this.#archive.run('archive', async () => {
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
    return this.#archive.run('archive', async () => {
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
