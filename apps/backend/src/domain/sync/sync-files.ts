import type { ManifestEntry, SyncRecord } from './manifest.ts';

// The bucket's own files beside the library (D117): `filmfile/sync.json` and
// `filmfile/manifest.json`. Read from the bucket, so checked field by field.

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0;

function json(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** The sync record in a `sync.json`'s text, or undefined if it isn't one. */
export function parseSyncRecord(text: string): SyncRecord | undefined {
  const value = json(text);
  if (
    !isObject(value) ||
    typeof value.archiveId !== 'string' ||
    value.archiveId === '' ||
    !isCount(value.sync) ||
    typeof value.computer !== 'string' ||
    typeof value.at !== 'string'
  ) {
    return undefined;
  }
  return {
    archiveId: value.archiveId,
    sync: value.sync,
    computer: value.computer,
    at: value.at,
  };
}

function manifestEntry(value: unknown): ManifestEntry | undefined {
  return isObject(value) &&
    typeof value.path === 'string' &&
    value.path !== '' &&
    isCount(value.size) &&
    typeof value.sha256 === 'string' &&
    /^[0-9a-f]{64}$/u.test(value.sha256)
    ? { path: value.path, size: value.size, sha256: value.sha256 }
    : undefined;
}

/** The files in a `manifest.json`'s text, or undefined if it isn't one. */
export function parseManifest(
  text: string,
): readonly ManifestEntry[] | undefined {
  const value = json(text);
  if (!isObject(value) || !Array.isArray(value.files)) {
    return undefined;
  }
  const files = value.files.map(manifestEntry);
  return files.every((file) => file !== undefined) ? files : undefined;
}

/** A sync record as `sync.json`'s text. */
export function syncRecordText(record: SyncRecord): string {
  return `${JSON.stringify(
    {
      archiveId: record.archiveId,
      sync: record.sync,
      computer: record.computer,
      at: record.at,
    },
    null,
    2,
  )}\n`;
}

/** A manifest as `manifest.json`'s text, a line to each file. */
export function manifestText(files: readonly ManifestEntry[]): string {
  return `{"files":[\n${files
    .map((file) =>
      JSON.stringify({ path: file.path, size: file.size, sha256: file.sha256 }),
    )
    .join(',\n')}\n]}\n`;
}
