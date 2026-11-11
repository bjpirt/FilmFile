import { mkdir, lstat, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { ExportFolder } from '../../../application/ports/export-destination.ts';
import { numberedPath } from '../../../application/use-cases/exports/export-names.ts';
import { hasErrorCode } from './error-codes.ts';
import { safePath } from './safe-path.ts';

async function exists(file: string): Promise<boolean> {
  try {
    await lstat(file);
    return true;
  } catch (error) {
    if (hasErrorCode(error, 'ENOENT')) {
      return false;
    }
    throw error;
  }
}

/**
 * A folder on disk the person chose (D100). Every path is built from single
 * names under it, so nothing reaches outside; a name that's taken is
 * numbered, never replaced; and a file is written under a temporary name and
 * then renamed, so a stopped export leaves no half-written JPEG.
 */
export class FilesystemExportFolder implements ExportFolder {
  readonly path: string;

  constructor(folder: string) {
    this.path = folder;
  }

  /** The name, or the name numbered, that nothing in the folder has. */
  async #freeName(folder: string, fileName: string): Promise<string> {
    for (let n = 1; ; n += 1) {
      const numbered = numberedPath(fileName, n);
      if (!(await exists(safePath(folder, numbered)))) {
        return numbered;
      }
    }
  }

  async write(relativePath: string, bytes: Uint8Array): Promise<string> {
    const names = relativePath.split('/');
    const fileName = names.pop() ?? '';
    const folder =
      names.length === 0 ? this.path : safePath(this.path, ...names);
    await mkdir(folder, { recursive: true });
    const written = await this.#freeName(folder, fileName);
    const target = safePath(folder, written);
    const temporary = safePath(folder, `.${written}.filmfile-part`);
    try {
      await writeFile(temporary, bytes);
      await rename(temporary, target);
    } catch (error) {
      await unlink(temporary).catch(() => undefined);
      throw error;
    }
    return path.posix.join(...names, written);
  }
}
