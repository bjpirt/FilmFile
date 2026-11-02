import { randomUUID } from 'node:crypto';
import { link, open, rename, rm } from 'node:fs/promises';
import { hasErrorCode } from './error-codes.ts';

/** Writes a new file beside the target and flushes it to disk, returning its path. */
async function writeTemporary(file: string, content: string): Promise<string> {
  // In the same folder, so it's on the same filesystem and rename is atomic.
  const temporary = `${file}.${randomUUID()}.tmp`;
  const handle = await open(temporary, 'wx');
  try {
    await handle.writeFile(content);
    await handle.sync();
  } finally {
    await handle.close();
  }
  return temporary;
}

/**
 * Replaces `file` with `content` all at once: a reader, or the file after a
 * crash, has the old content or the new, never part of each.
 */
export async function writeAtomically(
  file: string,
  content: string,
): Promise<void> {
  const temporary = await writeTemporary(file, content);
  try {
    await rename(temporary, file);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}

/**
 * Creates `file` with `content` all at once, unless it already exists: then
 * returns false and leaves it untouched.
 */
export async function createAtomically(
  file: string,
  content: string,
): Promise<boolean> {
  const temporary = await writeTemporary(file, content);
  try {
    // link fails if the file exists, where rename would replace it.
    await link(temporary, file);
    return true;
  } catch (error) {
    if (hasErrorCode(error, 'EEXIST')) {
      return false;
    }
    throw error;
  } finally {
    await rm(temporary, { force: true });
  }
}
