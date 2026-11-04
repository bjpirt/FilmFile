import { z } from 'zod';
import type { Archive } from '../../../domain/archive/archive.ts';
import { isArchiveId, type ArchiveId } from '../../../domain/shared/ids.ts';

// The persistence model for the archive itself: archive.json at its root.
// Author and copyright sit in `meta`, the archive-wide defaults frames
// inherit (design section 6). A `name` written before archives had none
// (D44) is ignored, and gone the next time the file is saved.

const currentSchema = 1;

const storedArchive = z.object({
  schema: z.literal(currentSchema),
  id: z.custom<ArchiveId>(
    (value) => typeof value === 'string' && isArchiveId(value),
    'must be a ULID',
  ),
  meta: z.object({
    author: z.string().min(1),
    copyright: z.string().optional(),
  }),
});

/** The archive in archive.json's text; throws if the file isn't one. */
export function parseArchiveFile(text: string): Archive {
  const { id, meta } = storedArchive.parse(JSON.parse(text));
  return { id, author: meta.author, copyright: meta.copyright ?? null };
}

/** The archive as archive.json text: keys in a fixed order, two-space indent, trailing newline. */
export function archiveFileContent(archive: Archive): string {
  const stored: z.input<typeof storedArchive> = {
    schema: currentSchema,
    id: archive.id,
    meta: {
      author: archive.author,
      // Only a copyright it has, so the file says nothing of a missing one.
      ...(archive.copyright === null ? {} : { copyright: archive.copyright }),
    },
  };
  return `${JSON.stringify(stored, null, 2)}\n`;
}
