import { z } from 'zod';
import type { Archive } from '../../../domain/archive/archive.ts';
import { isArchiveId, type ArchiveId } from '../../../domain/shared/ids.ts';

// The persistence model for the archive itself: archive.json at its root.
// Author and copyright sit in `meta`, the archive-wide defaults frames
// inherit (design section 6).

const currentSchema = 1;

const storedArchive = z.object({
  schema: z.literal(currentSchema),
  id: z.custom<ArchiveId>(
    (value) => typeof value === 'string' && isArchiveId(value),
    'must be a ULID',
  ),
  name: z.string().min(1),
  meta: z
    .object({
      author: z.string().optional(),
      copyright: z.string().optional(),
    })
    .default({}),
});

/** The archive in archive.json's text; throws if the file isn't one. */
export function parseArchiveFile(text: string): Archive {
  const { id, name, meta } = storedArchive.parse(JSON.parse(text));
  return {
    id,
    name,
    author: meta.author ?? null,
    copyright: meta.copyright ?? null,
  };
}

/** The archive as archive.json text: keys in a fixed order, two-space indent, trailing newline. */
export function archiveFileContent(archive: Archive): string {
  const stored: z.input<typeof storedArchive> = {
    schema: currentSchema,
    id: archive.id,
    name: archive.name,
    // Only the details it has, so the file says nothing of the rest.
    meta: {
      ...(archive.author === null ? {} : { author: archive.author }),
      ...(archive.copyright === null ? {} : { copyright: archive.copyright }),
    },
  };
  return `${JSON.stringify(stored, null, 2)}\n`;
}
