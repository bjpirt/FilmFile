import type { ArchiveContext } from '../domain/shared/archive-context.ts';
import { isArchiveId } from '../domain/shared/ids.ts';

/**
 * The archive has no ID of its own until archive.json is created when it's
 * set up (task 1.3.1), so every request acts on this one.
 */
export function localArchive(): ArchiveContext {
  const archiveId = '00000000000000000000000000';
  if (!isArchiveId(archiveId)) {
    throw new Error(`${archiveId} is not a ULID`);
  }
  return { archiveId };
}
