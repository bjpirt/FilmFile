import { createHash } from 'node:crypto';
import { glob, mkdir, readFile, rename } from 'node:fs/promises';
import path from 'node:path';
import type {
  ExpectedRollVersion,
  RollChange,
  RollListing,
  RollNumberChange,
  RollRepository,
  VersionedRoll,
  VersionedRollListing,
} from '../../../application/ports/roll-repository.ts';
import {
  folderName,
  rollFolderName,
} from '../../../domain/rolls/folder-names.ts';
import { folderHoldsNumber } from '../../../domain/rolls/folder-holds-number.ts';
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
import { parseRollFile, rollFileContent } from './roll-file.ts';
import {
  findRollFolder,
  rollFolderFor,
  rollFolderForNumberChange,
} from './roll-folder.ts';
import { exists, removeIfEmpty } from './folder-checks.ts';
import { moveVersionFolders } from './move-version-folders.ts';
import { renumberRollFolders } from './renumber-roll-folders.ts';
import { safePath } from './safe-path.ts';
import type { StoredRoll } from './stored-roll.ts';
import { createAtomically, writeAtomically } from './write-atomically.ts';

/** A version token: the SHA-256 of the file's bytes. */
function versionOf(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

/** `save` and `change` never change a roll's number: that's `saveRenumbered`'s (D70). */
function sameNumber(before: Roll, after: Roll): void {
  if (before.roll !== after.roll) {
    throw new Error(
      `roll ${before.id} was saved with another number: a number is changed with saveRenumbered`,
    );
  }
}

/**
 * Rolls kept as roll.json files in the archive, one folder per roll, named
 * by its number and ID and renamed when its number changes (D66). Every
 * write is atomic, and every roll read and change takes its turn, one at a
 * time (D77).
 */
export class FilesystemRollRepository implements RollRepository {
  readonly #archivePath: string;
  readonly #renameFolder: (
    source: string,
    destination: string,
  ) => Promise<void>;
  readonly #removeYear: (folder: string) => Promise<void>;
  // The one lock: every roll read and change takes its turn on it (D77). So a
  // listing is the same all through while a batch is checked and applied, a
  // roll number is checked and taken with no other roll taking it in between,
  // and a year folder isn't removed as a roll is put in it.
  readonly #archive = new KeyedLock();

  constructor(
    archivePath: string,
    renameFolder: (
      source: string,
      destination: string,
    ) => Promise<void> = rename,
    removeYear: (folder: string) => Promise<void> = removeIfEmpty,
  ) {
    this.#archivePath = archivePath;
    this.#renameFolder = renameFolder;
    this.#removeYear = removeYear;
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
      const folder = names.at(-2) ?? '';
      const file = safePath(this.#archivePath, ...names);
      const content = await readFile(file, 'utf8');
      const parsed = parseRollFile(content);
      if (!parsed.ok) {
        unreadable.push({ folder, problem: parsed.error });
      } else if (!folder.endsWith(`-${folderName(parsed.value.id)}`)) {
        // It can't be found by its ID, so it can't be opened (D112).
        unreadable.push({
          folder,
          problem: `its folder isn’t named with its ID; rename it to ${rollFolderName(parsed.value.roll, parsed.value.id)}`,
        });
      } else {
        stored.push({
          roll: parsed.value,
          version: versionOf(content),
          file,
          content,
        });
      }
    }
    return { stored, unreadable };
  }

  /** The roll, read from its own folder alone (D112); undefined if it can't be found or read. */
  async #find(id: RollId): Promise<StoredRoll | undefined> {
    const folder = await findRollFolder(this.#archivePath, id);
    if (folder === undefined) {
      return undefined;
    }
    const file = safePath(folder, 'roll.json');
    const content = await readFile(file, 'utf8');
    const parsed = parseRollFile(content);
    return parsed.ok && parsed.value.id === id
      ? { roll: parsed.value, version: versionOf(content), file, content }
      : undefined;
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
    return this.#archive.run('archive', async () => {
      const { stored, unreadable } = await this.#readAll();
      return {
        rolls: stored
          .sort((a, b) => compareRollNumbers(a.roll.roll, b.roll.roll))
          .map(({ roll, version }) => ({ roll, version })),
        unreadable: unreadable.sort((a, b) => a.folder.localeCompare(b.folder)),
      };
    });
  }

  async get(
    _ctx: ArchiveContext,
    id: RollId,
  ): Promise<VersionedRoll | undefined> {
    return this.#archive.run('archive', async () => {
      const found = await this.#find(id);
      return found && { roll: found.roll, version: found.version };
    });
  }

  /** Whether another roll has an equivalent number; unreadable safe labels are reserved too. */
  async #numberTaken(roll: Roll): Promise<boolean> {
    const { stored, unreadable } = await this.#readAll();
    return (
      stored.some(
        (s) => s.roll.id !== roll.id && sameRollNumber(s.roll.roll, roll.roll),
      ) || unreadable.some((u) => folderHoldsNumber(u.folder, roll.roll))
    );
  }

  async create(
    _ctx: ArchiveContext,
    roll: Roll,
  ): Promise<Result<void, AlreadyExists>> {
    // The number is checked and the folder made together, so two new rolls
    // can't both take it. A roll that can't be read counts: it's never built over.
    return this.#archive.run('archive', async () => {
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
   * Renames only the roll folder's leaf for its new number (D87); returns the roll.json in it. The folder is moved first,
   * then roll.json written in it, so a move cut short leaves a roll that's
   * still found, in a folder named for its new number. Called with the
   * archive's turn taken.
   */
  async #move(current: StoredRoll, roll: Roll): Promise<string> {
    const from = path.dirname(current.file);
    const to = rollFolderForNumberChange(from, roll);
    if (from !== to) {
      if (await exists(to)) {
        throw new Error(`${to} already exists, so ${from} can't be renamed`);
      }
      await mkdir(path.dirname(to), { recursive: true });
      await this.#renameFolder(from, to);
    }
    return safePath(to, 'roll.json');
  }

  save(
    _ctx: ArchiveContext,
    roll: Roll,
    expectedVersion: string,
  ): Promise<Result<string, NotFound | ConcurrencyConflict>> {
    return this.#archive.run('archive', async () => {
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
      const saved = await moveVersionFolders({
        current,
        roll,
        renameFolder: this.#renameFolder,
      });
      return ok(saved.version);
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
    return this.#archive.run('archive', async () => {
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
      if (
        !mayChangeRollNumber(current.roll) &&
        current.roll.roll !== roll.roll
      ) {
        return err({
          kind: 'validation-failed',
          issues: [{ path: ['roll'], message: filedRollNumberMessage }],
        });
      }
      const content = rollFileContent(roll);
      if (roll.roll === current.roll.roll) {
        await writeAtomically(current.file, content);
        return ok(versionOf(content));
      }
      // The number is checked, and the folder moved, with no other roll
      // taking a number or making a year folder in between.
      if (await this.#numberTaken(roll)) {
        return err({
          kind: 'already-exists',
          entity: 'roll',
          id: roll.roll,
        });
      }
      const file = await this.#move(current, roll);
      await writeAtomically(file, content);
      return ok(versionOf(content));
    });
  }

  saveRenumberedBatch(
    _ctx: ArchiveContext,
    expected: readonly ExpectedRollVersion[],
    unreadable: readonly UnreadableRoll[],
    changes: readonly RollNumberChange[],
  ): Promise<
    Result<void, AlreadyExists | ConcurrencyConflict | ValidationFailed>
  > {
    return this.#archive.run('archive', async () => {
      const current = await this.#readAll();
      const planned = planRollRenumbering({
        current: current.stored,
        currentUnreadable: current.unreadable,
        expected,
        expectedUnreadable: unreadable,
        changes,
      });
      if (!planned.ok) {
        return planned;
      }
      return renumberRollFolders({
        stored: current.stored,
        changes: planned.value,
        renameFolder: this.#renameFolder,
        removeYear: this.#removeYear,
      });
    });
  }

  change<T, E>(
    _ctx: ArchiveContext,
    id: RollId,
    apply: (roll: Roll) => Promise<Result<RollChange<T>, E>>,
  ): Promise<Result<T, E | NotFound>> {
    return this.#archive.run('archive', async () => {
      const current = await this.#find(id);
      if (current === undefined) {
        return err({ kind: 'not-found', entity: 'roll', id });
      }
      const changed = await apply(current.roll);
      if (!changed.ok) {
        return changed;
      }
      sameNumber(current.roll, changed.value.roll);
      await moveVersionFolders({
        current,
        roll: changed.value.roll,
        renameFolder: this.#renameFolder,
      });
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
      await this.#removeYear(path.dirname(path.dirname(current.file)));
      return ok(undefined);
    });
  }
}
