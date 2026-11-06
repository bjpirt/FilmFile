import { createHash } from 'node:crypto';
import { glob, mkdir, readFile, rename, rmdir, stat } from 'node:fs/promises';
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
  frameFolderName,
  versionFolderName,
} from '../../../domain/rolls/folder-names.ts';
import { yearOf, type RollNumber } from '../../../domain/rolls/roll-number.ts';
import type { Frame, Roll, Version } from '../../../domain/rolls/roll.ts';
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
  readonly content: string;
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

interface VersionFolderMove {
  readonly from: string;
  readonly to: string;
}

function versionFilePath(
  frame: Frame,
  version: Version,
  previousFile: string,
): string {
  return path.posix.join(
    'frames',
    frameFolderName(frame.number, frame.id),
    versionFolderName(version.kind, version.id),
    path.posix.basename(previousFile),
  );
}

function withChangedVersionPaths(before: Roll, after: Roll): Roll {
  const beforeFrames = new Map(before.frames.map((frame) => [frame.id, frame]));
  return {
    ...after,
    frames: after.frames.map((frame) => {
      const previousFrame = beforeFrames.get(frame.id);
      if (previousFrame === undefined) {
        return frame;
      }
      const numberChanged = previousFrame.number !== frame.number;
      return {
        ...frame,
        versions: frame.versions.map((version) => {
          const previousVersion = previousFrame.versions.find(
            (previous) => previous.id === version.id,
          );
          if (
            previousVersion === undefined ||
            (!numberChanged && previousVersion.kind === version.kind)
          ) {
            return version;
          }
          return {
            ...version,
            file: versionFilePath(frame, version, previousVersion.file),
          };
        }),
      };
    }),
  };
}

function versionFolderMoves(
  before: Roll,
  after: Roll,
  rollFolder: string,
): VersionFolderMove[] {
  const beforeFrames = new Map(before.frames.map((frame) => [frame.id, frame]));
  const moves: VersionFolderMove[] = [];
  for (const frame of after.frames) {
    const previousFrame = beforeFrames.get(frame.id);
    if (previousFrame === undefined) {
      continue;
    }
    for (const version of frame.versions) {
      const previousVersion = previousFrame.versions.find(
        (previous) => previous.id === version.id,
      );
      if (previousVersion === undefined) {
        continue;
      }
      const from = path.posix.dirname(previousVersion.file);
      const to = path.posix.dirname(version.file);
      if (from === to) {
        continue;
      }
      const expected = path.posix.join(
        'frames',
        frameFolderName(previousFrame.number, previousFrame.id),
        versionFolderName(previousVersion.kind, previousVersion.id),
      );
      if (from !== expected) {
        throw new Error(
          'version path does not match the supported folder layout',
        );
      }
      moves.push({
        from: safePath(rollFolder, ...from.split('/')),
        to: safePath(rollFolder, ...to.split('/')),
      });
    }
  }
  return moves;
}

/**
 * Rolls kept as roll.json files in the archive, one folder per roll, named
 * by its number and ID and renamed when its number changes (D66). Every
 * write is atomic, and writes to the same roll take turns.
 */
export class FilesystemRollRepository implements RollRepository {
  readonly #archivePath: string;
  readonly #renameFolder: (
    source: string,
    destination: string,
  ) => Promise<void>;
  readonly #removeYear: (folder: string) => Promise<void>;
  readonly #lock = new KeyedLock();
  readonly #archive = new KeyedLock();
  // Year folders are made and removed one at a time, so one isn't removed as a roll is put in it.
  readonly #years = new KeyedLock();

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

  async #saveChanged(
    current: StoredRoll,
    roll: Roll,
  ): Promise<{ readonly content: string; readonly version: string }> {
    const updated = withChangedVersionPaths(current.roll, roll);
    const content = rollFileContent(updated);
    const moves = versionFolderMoves(
      current.roll,
      updated,
      path.dirname(current.file),
    );
    const destinations = new Set<string>();
    for (const move of moves) {
      if (destinations.has(move.to)) {
        throw new Error('multiple versions use the same destination folder');
      }
      destinations.add(move.to);
      if (!(await isDirectory(move.from))) {
        throw new Error('version source folder is missing');
      }
      if (await exists(move.to)) {
        throw new Error('version destination folder already exists');
      }
    }

    const moved: VersionFolderMove[] = [];
    try {
      for (const move of moves) {
        await mkdir(path.dirname(move.to), { recursive: true });
        await this.#renameFolder(move.from, move.to);
        moved.push(move);
      }
      for (const folder of new Set(
        moves.map((move) => path.dirname(move.from)),
      )) {
        await removeIfEmpty(folder);
      }
      await writeAtomically(current.file, content);
    } catch (error) {
      const rollbackErrors: unknown[] = [];
      for (const move of [...moved].reverse()) {
        try {
          await mkdir(path.dirname(move.from), { recursive: true });
          await this.#renameFolder(move.to, move.from);
        } catch (rollbackError) {
          rollbackErrors.push(rollbackError);
        }
      }
      for (const move of moved) {
        try {
          await removeIfEmpty(path.dirname(move.to));
        } catch (rollbackError) {
          rollbackErrors.push(rollbackError);
        }
      }
      if (rollbackErrors.length > 0) {
        throw new AggregateError(
          [error, ...rollbackErrors],
          'version folder save failed and rollback was incomplete',
          { cause: error },
        );
      }
      throw error;
    }
    return { content, version: versionOf(content) };
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
        stored.push({
          roll: parsed.value,
          version: versionOf(content),
          file,
          content,
        });
      } else {
        unreadable.push({ folder: names.at(-2) ?? '', problem: parsed.error });
      }
    }
    return { stored, unreadable };
  }

  async #find(id: RollId): Promise<StoredRoll | undefined> {
    return (await this.#readAll()).stored.find((s) => s.roll.id === id);
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
          .sort((a, b) => a.roll.roll.localeCompare(b.roll.roll))
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
    return this.#archive.run('archive', () =>
      this.#years.run('years', async () => {
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
      }),
    );
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
      await this.#renameFolder(from, to);
      await removeIfEmpty(path.dirname(from));
    }
    return safePath(to, 'roll.json');
  }

  save(
    _ctx: ArchiveContext,
    roll: Roll,
    expectedVersion: string,
  ): Promise<Result<string, NotFound | ConcurrencyConflict>> {
    return this.#archive.run('archive', () =>
      this.#lock.run(roll.id, async () => {
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
        const saved = await this.#saveChanged(current, roll);
        return ok(saved.version);
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
    return this.#archive.run('archive', () =>
      this.#lock.run(roll.id, async () => {
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
      }),
    );
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
      const expectedById = new Map(expected.map((entry) => [entry.id, entry]));
      if (expectedById.size !== expected.length) {
        return err({
          kind: 'validation-failed',
          issues: [
            { path: ['snapshot'], message: 'contains a duplicate roll' },
          ],
        });
      }

      const currentById = new Map(
        current.stored.map((entry) => [entry.roll.id, entry]),
      );
      for (const entry of expected) {
        const found = currentById.get(entry.id);
        if (found?.version !== entry.version) {
          return err({
            kind: 'concurrency-conflict',
            entity: 'roll',
            id: entry.id,
          });
        }
      }
      const added = current.stored.find(
        (entry) => !expectedById.has(entry.roll.id),
      );
      if (added !== undefined || expected.length !== current.stored.length) {
        return err({
          kind: 'concurrency-conflict',
          entity: 'roll',
          id: added?.roll.id ?? expected[0]?.id ?? 'listing',
        });
      }
      const sortUnreadable = (entries: readonly UnreadableRoll[]) =>
        [...entries].sort((a, b) => a.folder.localeCompare(b.folder));
      if (
        JSON.stringify(sortUnreadable(current.unreadable)) !==
        JSON.stringify(sortUnreadable(unreadable))
      ) {
        return err({
          kind: 'concurrency-conflict',
          entity: 'roll',
          id: 'unreadable',
        });
      }

      const changesById = new Map(changes.map((change) => [change.id, change]));
      if (changesById.size !== changes.length) {
        return err({
          kind: 'validation-failed',
          issues: [{ path: ['changes'], message: 'contains a duplicate roll' }],
        });
      }
      for (const change of changes) {
        const found = currentById.get(change.id);
        if (found === undefined || !expectedById.has(change.id)) {
          return err({
            kind: 'validation-failed',
            issues: [
              { path: ['changes'], message: 'includes an unknown roll' },
            ],
          });
        }
        if (found.roll.filed && found.roll.roll !== change.roll) {
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
      }

      const finalRolls = current.stored.map((entry) => {
        const change = changesById.get(entry.roll.id);
        return change === undefined
          ? entry.roll
          : { ...entry.roll, roll: change.roll };
      });
      if (
        new Set(finalRolls.map((roll) => roll.roll)).size !== finalRolls.length
      ) {
        return err({
          kind: 'validation-failed',
          issues: [
            { path: ['changes'], message: 'roll numbers must be unique' },
          ],
        });
      }
      if (
        finalRolls.some((roll) =>
          current.unreadable.some((entry) => namedFor(entry.folder, roll.roll)),
        )
      ) {
        return err({
          kind: 'validation-failed',
          issues: [
            {
              path: ['changes'],
              message: 'a roll number is used by an unreadable roll folder',
            },
          ],
        });
      }

      const moving = current.stored.flatMap((entry) => {
        const change = changesById.get(entry.roll.id);
        if (change === undefined || change.roll === entry.roll.roll) {
          return [];
        }
        const roll = { ...entry.roll, roll: change.roll };
        const temporary = safePath(
          this.#archivePath,
          'rolls',
          yearOf(entry.roll.roll),
          `.renumber-${entry.roll.id}`,
        );
        return [
          {
            entry,
            roll,
            temporary,
            rollbackTemporary: safePath(
              this.#archivePath,
              'rolls',
              yearOf(entry.roll.roll),
              `.rollback-${entry.roll.id}`,
            ),
            destination: rollFolderFor(this.#archivePath, roll),
          },
        ];
      });
      const movingFolders = new Set(
        moving.map(({ entry }) => path.dirname(entry.file)),
      );
      for (const item of moving) {
        if (
          (await exists(item.temporary)) ||
          (await exists(item.rollbackTemporary))
        ) {
          throw new Error('a temporary roll folder already exists');
        }
        if (
          (await exists(item.destination)) &&
          !movingFolders.has(item.destination)
        ) {
          return err({
            kind: 'validation-failed',
            issues: [
              {
                path: ['changes'],
                message: 'a destination roll folder is already in use',
              },
            ],
          });
        }
      }
      const locations = new Map<RollId, string>();
      try {
        for (const item of moving) {
          await mkdir(path.dirname(item.destination), { recursive: true });
          await this.#renameFolder(
            path.dirname(item.entry.file),
            item.temporary,
          );
          locations.set(item.entry.roll.id, item.temporary);
        }
        for (const item of moving) {
          const file = safePath(item.temporary, 'roll.json');
          await writeAtomically(file, rollFileContent(item.roll));
          await this.#renameFolder(item.temporary, item.destination);
          locations.set(item.entry.roll.id, item.destination);
        }
        for (const item of moving) {
          await this.#removeYear(path.dirname(path.dirname(item.entry.file)));
        }
      } catch (error) {
        const rollbackErrors: unknown[] = [];
        const rollbackLocations = new Map<RollId, string>();
        for (const item of [...moving].reverse()) {
          const location = locations.get(item.entry.roll.id);
          if (location === undefined) {
            continue;
          }
          try {
            await mkdir(path.dirname(item.rollbackTemporary), {
              recursive: true,
            });
            await this.#renameFolder(location, item.rollbackTemporary);
            rollbackLocations.set(item.entry.roll.id, item.rollbackTemporary);
          } catch (rollbackError) {
            rollbackErrors.push(rollbackError);
          }
        }
        for (const item of [...moving].reverse()) {
          const location = rollbackLocations.get(item.entry.roll.id);
          if (location === undefined) {
            continue;
          }
          try {
            await writeAtomically(
              safePath(location, 'roll.json'),
              item.entry.content,
            );
          } catch (rollbackError) {
            rollbackErrors.push(rollbackError);
          }
          const originalFolder = path.dirname(item.entry.file);
          if (location !== originalFolder) {
            try {
              await mkdir(path.dirname(originalFolder), { recursive: true });
              await this.#renameFolder(location, originalFolder);
            } catch (rollbackError) {
              rollbackErrors.push(rollbackError);
            }
          }
        }
        const originalYears = new Set(
          moving.map(({ entry }) => path.dirname(path.dirname(entry.file))),
        );
        for (const item of moving) {
          const destinationYear = path.dirname(item.destination);
          if (!originalYears.has(destinationYear)) {
            try {
              await this.#removeYear(destinationYear);
            } catch (rollbackError) {
              rollbackErrors.push(rollbackError);
            }
          }
        }
        if (rollbackErrors.length > 0) {
          throw new AggregateError(
            [error, ...rollbackErrors],
            'Roll renumbering failed and rollback was incomplete.',
            { cause: error },
          );
        }
        throw error;
      }
      return ok(undefined);
    });
  }

  change<T, E>(
    _ctx: ArchiveContext,
    id: RollId,
    apply: (roll: Roll) => Promise<Result<RollChange<T>, E>>,
  ): Promise<Result<T, E | NotFound>> {
    return this.#archive.run('archive', () =>
      this.#lock.run(id, async () => {
        const current = await this.#find(id);
        if (current === undefined) {
          return err({ kind: 'not-found', entity: 'roll', id });
        }
        const changed = await apply(current.roll);
        if (!changed.ok) {
          return changed;
        }
        sameNumber(current.roll, changed.value.roll);
        await this.#saveChanged(current, changed.value.roll);
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
    return this.#archive.run('archive', () =>
      this.#lock.run(id, async () => {
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
          this.#removeYear(path.dirname(path.dirname(current.file))),
        );
        return ok(undefined);
      }),
    );
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

async function isDirectory(folder: string): Promise<boolean> {
  try {
    return (await stat(folder)).isDirectory();
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
