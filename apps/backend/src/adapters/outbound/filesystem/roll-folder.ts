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
// A roll is found only in a folder whose name ends with the end of its ID,
// and only if the roll.json there says that ID (D112): the name says where to
// look, the file says whose it is. A rename cut short keeps the ID, so it's
// still found; nothing searches the other folders.

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

/**
 * The folder a roll is in: the one named with the end of its ID whose
 * roll.json says it's the roll's. Undefined if there's none, including when
 * the roll's folder is named some other way (D112).
 */
export async function findRollFolder(
  archivePath: string,
  id: RollId,
): Promise<string | undefined> {
  for await (const relative of glob(`rolls/*/*-${folderName(id)}/roll.json`, {
    cwd: archivePath,
  })) {
    const file = safePath(archivePath, ...relative.split(path.sep));
    if (idIn(await readFile(file, 'utf8')) === id) {
      return path.dirname(file);
    }
  }
  return undefined;
}
