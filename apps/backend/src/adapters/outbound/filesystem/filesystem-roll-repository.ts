import { createHash } from 'node:crypto';
import { glob, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type {
  RollChange,
  RollListing,
  RollRepository,
  VersionedRoll,
} from '../../../application/ports/roll-repository.ts';
import { yearOf, type RollNumber } from '../../../domain/rolls/roll-number.ts';
import type { Roll } from '../../../domain/rolls/roll.ts';
import type { UnreadableRoll } from '../../../domain/rolls/unreadable-roll.ts';
import type { ArchiveContext } from '../../../domain/shared/archive-context.ts';
import type {
  AlreadyExists,
  ConcurrencyConflict,
  NotFound,
} from '../../../domain/shared/domain-error.ts';
import type { RollId } from '../../../domain/shared/ids.ts';
import { err, ok, type Result } from '../../../domain/shared/result.ts';
import { KeyedLock } from '../node/keyed-lock.ts';
import { parseRollFile, rollFileContent } from './roll-file.ts';
import { safePath } from './safe-path.ts';
import { createAtomically, writeAtomically } from './write-atomically.ts';

/** A roll's folder in the archive: `rolls/YYYY/YYYY-NNN/`. */
export function rollFolder(archivePath: string, roll: RollNumber): string {
  return safePath(archivePath, 'rolls', yearOf(roll), roll);
}

/** A version token: the SHA-256 of the file's bytes. */
function versionOf(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

interface StoredRoll extends VersionedRoll {
  readonly file: string;
}

/**
 * Rolls kept as roll.json files in the archive, one folder per roll. Every
 * write is atomic, and writes to the same roll take turns.
 */
export class FilesystemRollRepository implements RollRepository {
  readonly #archivePath: string;
  readonly #lock = new KeyedLock();

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

  async create(
    _ctx: ArchiveContext,
    roll: Roll,
  ): Promise<Result<void, AlreadyExists>> {
    const folder = rollFolder(this.#archivePath, roll.roll);
    await mkdir(folder, { recursive: true });
    const created = await createAtomically(
      safePath(folder, 'roll.json'),
      rollFileContent(roll),
    );
    return created
      ? ok(undefined)
      : err({ kind: 'already-exists', entity: 'roll', id: roll.roll });
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
      const content = rollFileContent(roll);
      await writeAtomically(current.file, content);
      return ok(versionOf(content));
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
      return ok(undefined);
    });
  }
}
