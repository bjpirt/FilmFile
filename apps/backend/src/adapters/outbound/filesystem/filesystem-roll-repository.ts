import { createHash } from 'node:crypto';
import { glob, mkdir, readFile, rename, rmdir, stat } from 'node:fs/promises';
import path from 'node:path';
import type {
  RollChange,
  RollListing,
  RollRepository,
  VersionedRoll,
} from '../../../application/ports/roll-repository.ts';
import type { RollNumber } from '../../../domain/rolls/roll-number.ts';
import type { Roll } from '../../../domain/rolls/roll.ts';
import type { UnreadableRoll } from '../../../domain/rolls/unreadable-roll.ts';
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
import { hasErrorCode } from './error-codes.ts';
import { parseRollFile, rollFileContent } from './roll-file.ts';
import { rollFolderFor } from './roll-folder.ts';
import { safePath } from './safe-path.ts';
import { createAtomically, writeAtomically } from './write-atomically.ts';

/** A version token: the SHA-256 of the file's bytes. */
function versionOf(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

interface StoredRoll extends VersionedRoll {
  readonly file: string;
}

/** `save` and `change` never change a roll's number: that's `saveRenumbered`'s (D70). */
function sameNumber(before: Roll, after: Roll): void {
  if (before.roll !== after.roll) {
    throw new Error(
      `roll ${before.id} was saved with another number: a number is changed with saveRenumbered`,
    );
  }
}

/** Whether an unreadable roll's folder is named for this roll number: `2026-014` or `2026-014-Q2P7RM4K`. */
function namedFor(folder: string, roll: RollNumber): boolean {
  return folder === roll || folder.startsWith(`${roll}-`);
}

/**
 * Rolls kept as roll.json files in the archive, one folder per roll, named
 * by its number and ID and renamed when its number changes (D66). Every
 * write is atomic, and writes to the same roll take turns.
 */
export class FilesystemRollRepository implements RollRepository {
  readonly #archivePath: string;
  readonly #lock = new KeyedLock();
  // Year folders are made and removed one at a time, so one isn't removed as a roll is put in it.
  readonly #years = new KeyedLock();

  constructor(archivePath: string) {
    this.#archivePath = archivePath;
  }

  async #readAll(): Promise<{
    stored: StoredRoll[];
    unreadable: UnreadableRoll[];
  }> {
    const stored: StoredRoll[] = [];
    const unreadable: UnreadableRoll[] = [];
    for await (const relative of glob('rolls/*/*/roll.json', {
      cwd: this.#archivePath,
    })) {
      const names = relative.split(path.sep);
      const file = safePath(this.#archivePath, ...names);
      const content = await readFile(file, 'utf8');
      const parsed = parseRollFile(content);
      if (parsed.ok) {
        stored.push({ roll: parsed.value, version: versionOf(content), file });
      } else {
        unreadable.push({ folder: names.at(-2) ?? '', problem: parsed.error });
      }
    }
    return { stored, unreadable };
  }

  async #find(id: RollId): Promise<StoredRoll | undefined> {
    return (await this.#readAll()).stored.find((s) => s.roll.id === id);
  }

  async list(): Promise<RollListing> {
    const { stored, unreadable } = await this.#readAll();
    return {
      rolls: stored
        .map((s) => s.roll)
        .sort((a, b) => a.roll.localeCompare(b.roll)),
      unreadable: unreadable.sort((a, b) => a.folder.localeCompare(b.folder)),
    };
  }

  async get(
    _ctx: ArchiveContext,
    id: RollId,
  ): Promise<VersionedRoll | undefined> {
    const found = await this.#find(id);
    return found && { roll: found.roll, version: found.version };
  }

  /** Whether another roll has this roll's number; a roll that can't be read counts if its folder is named for it. */
  async #numberTaken(roll: Roll): Promise<boolean> {
    const { stored, unreadable } = await this.#readAll();
    return (
      stored.some((s) => s.roll.id !== roll.id && s.roll.roll === roll.roll) ||
      unreadable.some((u) => namedFor(u.folder, roll.roll))
    );
  }

  async create(
    _ctx: ArchiveContext,
    roll: Roll,
  ): Promise<Result<void, AlreadyExists>> {
    // The number is checked and the folder made together, so two new rolls
    // can't both take it. A roll that can't be read counts: it's never built over.
    return this.#years.run('years', async () => {
      if (await this.#numberTaken(roll)) {
        return err({ kind: 'already-exists', entity: 'roll', id: roll.roll });
      }
      const folder = rollFolderFor(this.#archivePath, roll);
      await mkdir(folder, { recursive: true });
      const created = await createAtomically(
        safePath(folder, 'roll.json'),
        rollFileContent(roll),
      );
      return created
        ? ok(undefined)
        : err({ kind: 'already-exists', entity: 'roll', id: roll.roll });
    });
  }

  /**
   * Moves a roll's folder for its new number, to another year's folder if
   * need be (D66); returns the roll.json in it. The folder is moved first,
   * then roll.json written in it, so a move cut short leaves a roll that's
   * still found, in a folder named for its new number. Called with the
   * years' turn taken.
   */
  async #move(current: StoredRoll, roll: Roll): Promise<string> {
    const from = path.dirname(current.file);
    const to = rollFolderFor(this.#archivePath, roll);
    if (from !== to) {
      if (await exists(to)) {
        throw new Error(`${to} already exists, so ${from} can't be renamed`);
      }
      await mkdir(path.dirname(to), { recursive: true });
      await rename(from, to);
      await removeIfEmpty(path.dirname(from));
    }
    return safePath(to, 'roll.json');
  }

  save(
    _ctx: ArchiveContext,
    roll: Roll,
    expectedVersion: string,
  ): Promise<Result<string, NotFound | ConcurrencyConflict>> {
    return this.#lock.run(roll.id, async () => {
      const current = await this.#find(roll.id);
      if (current === undefined) {
        return err({ kind: 'not-found', entity: 'roll', id: roll.id });
      }
      if (current.version !== expectedVersion) {
        return err({
          kind: 'concurrency-conflict',
          entity: 'roll',
          id: roll.id,
        });
      }
      sameNumber(current.roll, roll);
      const content = rollFileContent(roll);
      await writeAtomically(current.file, content);
      return ok(versionOf(content));
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
    return this.#lock.run(roll.id, async () => {
      const current = await this.#find(roll.id);
      if (current === undefined) {
        return err({ kind: 'not-found', entity: 'roll', id: roll.id });
      }
      if (current.version !== expectedVersion) {
        return err({
          kind: 'concurrency-conflict',
          entity: 'roll',
          id: roll.id,
        });
      }
      if (current.roll.filed && current.roll.roll !== roll.roll) {
        return err({
          kind: 'validation-failed',
          issues: [
            {
              path: ['roll'],
              message: "A filed roll's number can't be changed.",
            },
          ],
        });
      }
      const content = rollFileContent(roll);
      if (roll.roll === current.roll.roll) {
        await writeAtomically(current.file, content);
        return ok(versionOf(content));
      }
      // The number is checked, and the folder moved, with no other roll
      // taking a number or making a year folder in between.
      return this.#years.run('years', async () => {
        if (await this.#numberTaken(roll)) {
          return err({ kind: 'already-exists', entity: 'roll', id: roll.roll });
        }
        const file = await this.#move(current, roll);
        await writeAtomically(file, content);
        return ok(versionOf(content));
      });
    });
  }

  change<T, E>(
    _ctx: ArchiveContext,
    id: RollId,
    apply: (roll: Roll) => Promise<Result<RollChange<T>, E>>,
  ): Promise<Result<T, E | NotFound>> {
    return this.#lock.run(id, async () => {
      const current = await this.#find(id);
      if (current === undefined) {
        return err({ kind: 'not-found', entity: 'roll', id });
      }
      const changed = await apply(current.roll);
      if (!changed.ok) {
        return changed;
      }
      sameNumber(current.roll, changed.value.roll);
      await writeAtomically(current.file, rollFileContent(changed.value.roll));
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
      const current = await this.#find(id);
      if (current === undefined) {
        return err({ kind: 'not-found', entity: 'roll', id });
      }
      if (current.version !== expectedVersion) {
        return err({ kind: 'concurrency-conflict', entity: 'roll', id });
      }
      await handOver(current.roll);
      if (await this.#find(id)) {
        throw new Error(
          `roll ${id} was handed over but is still in the archive`,
        );
      }
      // The year's folder is left empty if that was its last roll.
      await this.#years.run('years', () =>
        removeIfEmpty(path.dirname(path.dirname(current.file))),
      );
      return ok(undefined);
    });
  }
}

async function exists(folder: string): Promise<boolean> {
  try {
    await stat(folder);
    return true;
  } catch (error) {
    if (hasErrorCode(error, 'ENOENT')) {
      return false;
    }
    throw error;
  }
}

/** Removes a folder if it's empty; never one with anything in it. */
async function removeIfEmpty(folder: string): Promise<void> {
  try {
    await rmdir(folder);
  } catch (error) {
    if (!hasErrorCode(error, 'ENOTEMPTY') && !hasErrorCode(error, 'ENOENT')) {
      throw error;
    }
  }
}
