import { readdir } from 'node:fs/promises';
import path from 'node:path';

/**
 * A roll's folder in a test archive, found by its number whatever it's
 * called: `2026-014-Q2P7RM4K` (D66), or `2026-014` from before that naming.
 */
export async function folderOfRoll(
  archivePath: string,
  number: string,
): Promise<string> {
  const year = path.join(archivePath, 'rolls', number.slice(0, 4));
  const found = (await readdir(year)).filter(
    (name) => name === number || name.startsWith(`${number}-`),
  );
  if (found.length !== 1) {
    throw new Error(
      `expected one folder for roll ${number} in ${year}, found ${String(found.length)}`,
    );
  }
  return path.join(year, found[0] ?? '');
}
