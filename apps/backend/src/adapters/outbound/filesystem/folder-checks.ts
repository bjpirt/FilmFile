import { rmdir, stat } from 'node:fs/promises';
import { hasErrorCode } from './error-codes.ts';

// Three small checks on one folder, kept together because the repository and
// the folder moves all use them: a deliberate exception to one export a file.

export async function exists(folder: string): Promise<boolean> {
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

export async function isDirectory(folder: string): Promise<boolean> {
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
export async function removeIfEmpty(folder: string): Promise<void> {
  try {
    await rmdir(folder);
  } catch (error) {
    if (!hasErrorCode(error, 'ENOTEMPTY') && !hasErrorCode(error, 'ENOENT')) {
      throw error;
    }
  }
}
