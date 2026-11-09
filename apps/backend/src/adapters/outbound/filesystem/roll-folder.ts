import { glob, readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  folderName,
  rollFolderName,
} from '../../../domain/rolls/folder-names.ts';
import type { RollNumber } from '../../../domain/rolls/roll-number.ts';
import type { RollId } from '../../../domain/shared/ids.ts';
import { safePath } from './safe-path.ts';

// New roll folders use the shot year and a safe version of the number label;
// existing folders keep their parent when the label changes (D87).
// A roll is found by the roll.json in its folder, never by the folder's name,
// so folders made before this naming, and any a rename left half done, are
// found too.

/** Where a new roll's folder goes: `rolls/<shot year>/<safe label>-<ID>/`. */
export function rollFolderFor(
  archivePath: string,
  roll: {
    readonly id: RollId;
    readonly roll: RollNumber;
    readonly shot: string | null;
  },
): string {
  const numberYear = /^\d{4}(?=-)/u.exec(roll.roll)?.[0];
  const year = roll.shot?.slice(0, 4) ?? numberYear ?? 'undated';
  return safePath(
    archivePath,
    'rolls',
    year,
    rollFolderName(roll.roll, roll.id),
  );
}

/** A changed roll number renames only the leaf within its current parent. */
export function rollFolderForNumberChange(
  currentFolder: string,
  roll: { readonly id: RollId; readonly roll: RollNumber },
): string {
  return safePath(
    path.dirname(currentFolder),
    rollFolderName(roll.roll, roll.id),
  );
}

/** The ID a roll.json's text says, or undefined if it isn't JSON with one. */
function idIn(text: string): unknown {
  try {
    const json: unknown = JSON.parse(text);
    return typeof json === 'object' && json !== null && 'id' in json
      ? json.id
      : undefined;
  } catch {
    return undefined;
  }
}

async function folderHolding(
  archivePath: string,
  pattern: string,
  id: RollId,
): Promise<string | undefined> {
  for await (const relative of glob(pattern, { cwd: archivePath })) {
    const file = safePath(archivePath, ...relative.split(path.sep));
    if (idIn(await readFile(file, 'utf8')) === id) {
      return path.dirname(file);
    }
  }
  return undefined;
}

/**
 * The folder a roll is in now, whatever it's called: the one named with its
 * ID if there is one, otherwise any folder whose roll.json says it's the
 * roll's (a name from before this naming, or an interrupted rename's).
 * Undefined if the roll has no folder.
 */
export async function findRollFolder(
  archivePath: string,
  id: RollId,
): Promise<string | undefined> {
  return (
    (await folderHolding(
      archivePath,
      `rolls/*/*-${folderName(id)}/roll.json`,
      id,
    )) ?? (await folderHolding(archivePath, 'rolls/*/*/roll.json', id))
  );
}
