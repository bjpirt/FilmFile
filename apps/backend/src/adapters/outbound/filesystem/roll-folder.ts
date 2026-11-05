import { glob, readFile } from 'node:fs/promises';
import path from 'node:path';
import { folderName } from '../../../domain/rolls/folder-names.ts';
import { yearOf, type RollNumber } from '../../../domain/rolls/roll-number.ts';
import type { RollId } from '../../../domain/shared/ids.ts';
import { safePath } from './safe-path.ts';

// A roll's folder is named by its number and the end of its ID, so rolls can
// swap numbers without their folders clashing (D66): `rolls/2026/2026-014-Q2P7RM4K/`.
// A roll is found by the roll.json in its folder, never by the folder's name,
// so folders made before this naming, and any a rename left half done, are
// found too.

/** Where a roll's folder is, or goes when its number changes: `rolls/YYYY/YYYY-NNN-<ID>/`. */
export function rollFolderFor(
  archivePath: string,
  roll: { readonly id: RollId; readonly roll: RollNumber },
): string {
  return safePath(
    archivePath,
    'rolls',
    yearOf(roll.roll),
    `${roll.roll}-${folderName(roll.id)}`,
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
