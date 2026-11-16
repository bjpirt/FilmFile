import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import type { RollNumber } from '../../../domain/rolls/roll-number.ts';
import type { ValidationFailed } from '../../../domain/shared/domain-error.ts';
import type { RollId } from '../../../domain/shared/ids.ts';
import { err, ok, type Result } from '../../../domain/shared/result.ts';
import { exists } from './folder-checks.ts';
import { rollFileContent } from './roll-file.ts';
import { rollFolderForNumberChange } from './roll-folder.ts';
import { safePath } from './safe-path.ts';
import type { StoredRoll } from './stored-roll.ts';
import { writeAtomically } from './write-atomically.ts';

/**
 * Moves the given rolls' folders to their new numbers together, through
 * temporary names so two rolls can swap numbers. If any step fails it puts
 * every folder and roll.json back, and a rollback that can't finish is
 * reported with the error that caused it. It is not crash-atomic (D78).
 */
export async function renumberRollFolders(input: {
  readonly stored: readonly StoredRoll[];
  readonly changes: readonly {
    readonly id: RollId;
    readonly roll: RollNumber;
  }[];
  readonly renameFolder: (source: string, destination: string) => Promise<void>;
  readonly removeYear: (folder: string) => Promise<void>;
}): Promise<Result<void, ValidationFailed>> {
  const { stored, changes, renameFolder, removeYear } = input;
  const changesById = new Map(changes.map((change) => [change.id, change]));
  const moving = stored.flatMap((entry) => {
    const change = changesById.get(entry.roll.id);
    if (change === undefined) {
      return [];
    }
    const roll = { ...entry.roll, roll: change.roll };
    const currentFolder = path.dirname(entry.file);
    const parentFolder = path.dirname(currentFolder);
    const temporary = safePath(parentFolder, `.renumber-${entry.roll.id}`);
    return [
      {
        entry,
        roll,
        temporary,
        rollbackTemporary: safePath(parentFolder, `.rollback-${entry.roll.id}`),
        destination: rollFolderForNumberChange(currentFolder, roll),
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
      await renameFolder(path.dirname(item.entry.file), item.temporary);
      locations.set(item.entry.roll.id, item.temporary);
    }
    for (const item of moving) {
      const file = safePath(item.temporary, 'roll.json');
      await writeAtomically(file, rollFileContent(item.roll));
      await renameFolder(item.temporary, item.destination);
      locations.set(item.entry.roll.id, item.destination);
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
        await renameFolder(location, item.rollbackTemporary);
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
          await renameFolder(location, originalFolder);
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
          await removeYear(destinationYear);
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
}
