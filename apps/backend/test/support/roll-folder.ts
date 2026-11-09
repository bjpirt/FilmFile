import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * A roll's folder in a test archive, found by its roll.json number wherever
 * the folder is parented or named.
 */
export async function folderOfRoll(
  archivePath: string,
  number: string,
): Promise<string> {
  const root = path.join(archivePath, 'rolls');
  const found: string[] = [];
  for (const year of await readdir(root)) {
    const yearPath = path.join(root, year);
    for (const folder of await readdir(yearPath)) {
      try {
        const parsed: unknown = JSON.parse(
          await readFile(path.join(yearPath, folder, 'roll.json'), 'utf8'),
        );
        if (
          typeof parsed === 'object' &&
          parsed !== null &&
          'roll' in parsed &&
          parsed.roll === number
        ) {
          found.push(path.join(yearPath, folder));
        }
      } catch {
        continue;
      }
    }
  }
  if (found.length !== 1) {
    throw new Error(
      `expected one folder for roll ${number}, found ${String(found.length)}`,
    );
  }
  return found[0] ?? '';
}
