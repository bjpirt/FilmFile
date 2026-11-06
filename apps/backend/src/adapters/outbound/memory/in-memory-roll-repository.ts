import type {
  RollChange,
  RollListing,
  RollRepository,
  VersionedRollListing,
  VersionedRoll,
} from '../../../application/ports/roll-repository.ts';
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
  readonly #lock = new KeyedLock();
  readonly #writes = new KeyedLock();
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
      a.roll.roll.localeCompare(b.roll.roll),
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
    return this.#writes.run<Result<void, AlreadyExists>>('archive', () => {
      if ([...this.#rolls.values()].some((r) => r.roll.roll === roll.roll)) {
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
    return this.#writes.run('archive', () =>
      this.#lock.run(roll.id, () => {
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
      }),
    );
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
    // One at a time across rolls, so two can't both take a number.
    return this.#writes.run('archive', () =>
      this.#lock.run('numbers', () => {
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
        } else if (current.roll.filed && current.roll.roll !== roll.roll) {
          result = err({
            kind: 'validation-failed',
            issues: [
              {
                path: ['roll'],
                message: "A filed roll's number can't be changed.",
              },
            ],
          });
        } else if (
          [...this.#rolls.values()].some(
            (r) => r.roll.id !== roll.id && r.roll.roll === roll.roll,
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
      }),
    );
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
    return this.#writes.run<
      Result<void, AlreadyExists | ConcurrencyConflict | ValidationFailed>
    >('archive', () => {
      const current = [...this.#rolls.values()];
      const expectedById = new Map(expected.map((entry) => [entry.id, entry]));
      if (expectedById.size !== expected.length) {
        return Promise.resolve(
          err({
            kind: 'validation-failed',
            issues: [
              { path: ['snapshot'], message: 'contains a duplicate roll' },
            ],
          }),
        );
      }
      for (const entry of expected) {
        const found = this.#rolls.get(entry.id);
        if (found?.version !== entry.version) {
          return Promise.resolve(
            err({
              kind: 'concurrency-conflict',
              entity: 'roll',
              id: entry.id,
            }),
          );
        }
      }
      const extra = current.find(({ roll }) => !expectedById.has(roll.id));
      if (extra !== undefined || expected.length !== current.length) {
        return Promise.resolve(
          err({
            kind: 'concurrency-conflict',
            entity: 'roll',
            id: extra?.roll.id ?? expected[0]?.id ?? 'listing',
          }),
        );
      }
      if (unreadable.length > 0) {
        return Promise.resolve(
          err({
            kind: 'concurrency-conflict',
            entity: 'roll',
            id: 'unreadable',
          }),
        );
      }

      const changesById = new Map(changes.map((change) => [change.id, change]));
      if (changesById.size !== changes.length) {
        return Promise.resolve(
          err({
            kind: 'validation-failed',
            issues: [
              { path: ['changes'], message: 'contains a duplicate roll' },
            ],
          }),
        );
      }
      for (const change of changes) {
        const found = this.#rolls.get(change.id);
        if (found === undefined || !expectedById.has(change.id)) {
          return Promise.resolve(
            err({
              kind: 'validation-failed',
              issues: [
                { path: ['changes'], message: 'includes an unknown roll' },
              ],
            }),
          );
        }
        if (found.roll.filed && found.roll.roll !== change.roll) {
          return Promise.resolve(
            err({
              kind: 'validation-failed',
              issues: [
                {
                  path: ['roll'],
                  message: "A filed roll's number can't be changed.",
                },
              ],
            }),
          );
        }
      }
      const finalNumbers = current.map(
        ({ roll }) => changesById.get(roll.id)?.roll ?? roll.roll,
      );
      if (new Set(finalNumbers).size !== finalNumbers.length) {
        return Promise.resolve(
          err({
            kind: 'validation-failed',
            issues: [
              { path: ['changes'], message: 'roll numbers must be unique' },
            ],
          }),
        );
      }
      for (const change of changes) {
        const found = this.#rolls.get(change.id);
        if (found !== undefined && found.roll.roll !== change.roll) {
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
    return this.#writes.run('archive', () =>
      this.#lock.run(id, async () => {
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
      }),
    );
  }

  remove(
    _ctx: ArchiveContext,
    id: RollId,
    expectedVersion: string,
    handOver: (roll: Roll) => Promise<void>,
  ): Promise<Result<void, NotFound | ConcurrencyConflict>> {
    return this.#writes.run('archive', () =>
      this.#lock.run(id, async () => {
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
      }),
    );
  }
}
