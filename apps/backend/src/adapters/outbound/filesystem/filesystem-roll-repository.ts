import { glob, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type {
  RollListing,
  RollRepository,
} from '../../../application/ports/roll-repository.ts';
import { yearOf, type RollNumber } from '../../../domain/rolls/roll-number.ts';
import type { Roll } from '../../../domain/rolls/roll.ts';
import type { UnreadableRoll } from '../../../domain/rolls/unreadable-roll.ts';
import type { ArchiveContext } from '../../../domain/shared/archive-context.ts';
import type {
  AlreadyExists,
  NotFound,
} from '../../../domain/shared/domain-error.ts';
import type { RollId } from '../../../domain/shared/ids.ts';
import { err, ok, type Result } from '../../../domain/shared/result.ts';
import { hasErrorCode } from './error-codes.ts';
import { parseRollFile, rollFileContent } from './roll-file.ts';
import { safePath } from './safe-path.ts';

/** A roll's folder in the archive: `rolls/YYYY/YYYY-NNN/`. */
export function rollFolder(archivePath: string, roll: RollNumber): string {
  return safePath(archivePath, 'rolls', yearOf(roll), roll);
}

/**
 * Rolls kept as roll.json files in the archive, one folder per roll. Writes
 * aren't yet atomic or guarded by version tokens: that's task H.9.
 */
export class FilesystemRollRepository implements RollRepository {
  readonly #archivePath: string;

  constructor(archivePath: string) {
    this.#archivePath = archivePath;
  }

  #rollFile(roll: RollNumber): string {
    return safePath(rollFolder(this.#archivePath, roll), 'roll.json');
  }

  async list(): Promise<RollListing> {
    const rolls: Roll[] = [];
    const unreadable: UnreadableRoll[] = [];
    for await (const relative of glob('rolls/*/*/roll.json', {
      cwd: this.#archivePath,
    })) {
      const names = relative.split(path.sep);
      const file = safePath(this.#archivePath, ...names);
      const parsed = parseRollFile(await readFile(file, 'utf8'));
      if (parsed.ok) {
        rolls.push(parsed.value);
      } else {
        unreadable.push({ folder: names.at(-2) ?? '', problem: parsed.error });
      }
    }
    return {
      rolls: rolls.sort((a, b) => a.roll.localeCompare(b.roll)),
      unreadable: unreadable.sort((a, b) => a.folder.localeCompare(b.folder)),
    };
  }

  async get(_ctx: ArchiveContext, id: RollId): Promise<Roll | undefined> {
    return (await this.list()).rolls.find((roll) => roll.id === id);
  }

  async create(
    _ctx: ArchiveContext,
    roll: Roll,
  ): Promise<Result<void, AlreadyExists>> {
    await mkdir(rollFolder(this.#archivePath, roll.roll), { recursive: true });
    try {
      // 'wx' fails if the file exists, so two rolls can't share a roll number.
      await writeFile(this.#rollFile(roll.roll), rollFileContent(roll), {
        flag: 'wx',
      });
    } catch (error) {
      if (hasErrorCode(error, 'EEXIST')) {
        return err({ kind: 'already-exists', entity: 'roll', id: roll.roll });
      }
      throw error;
    }
    return ok(undefined);
  }

  async save(
    _ctx: ArchiveContext,
    roll: Roll,
  ): Promise<Result<void, NotFound>> {
    const file = this.#rollFile(roll.roll);
    try {
      await stat(file);
    } catch (error) {
      if (hasErrorCode(error, 'ENOENT')) {
        return err({ kind: 'not-found', entity: 'roll', id: roll.id });
      }
      throw error;
    }
    await writeFile(file, rollFileContent(roll));
    return ok(undefined);
  }
}
