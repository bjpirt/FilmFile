import type { ApiClient } from '@filmfile/contracts/client';
import type { Roll } from '@filmfile/contracts/rolls';
import {
  occupiedLabels,
  suggestImportedNumber,
  type RollNumberPattern,
} from './roll-number-pattern.ts';
import type { ImportFolder } from './import-folders.ts';
import { uploadScans, type UploadReport } from './upload-scans.ts';

/** A roll ready to be made from a folder: its number, name and date shot, as they'll be sent. */
export interface RollToImport {
  readonly folder: ImportFolder;
  readonly number: string;
  readonly shot: string;
  /** Whether its number has "MM", "DD" or "event" in it, for details it doesn't have yet. */
  readonly placeholder: boolean;
}

/** What happened to one folder of an import, in the order they were given. */
export type ImportResult =
  | {
      readonly kind: 'imported';
      readonly id: string;
      readonly number: string;
      readonly name: string;
      readonly shot: string;
      readonly placeholder: boolean;
      readonly report: UploadReport;
    }
  /** The roll couldn't be made, so its scans weren't tried. */
  | {
      readonly kind: 'failed';
      readonly name: string;
      readonly reason: string;
    }
  /** Not started, because the import was cancelled. */
  | { readonly kind: 'not-started'; readonly name: string };

/** How many times a roll whose number was taken in the meantime is given another. */
const attempts = 5;

/** A roll's name is its folder's, as long as a name can be. */
export function rollNameOf(folder: ImportFolder): string {
  return folder.name.trim().slice(0, 100);
}

/**
 * Makes each roll and adds its scans, one at a time in order (FF-154, D90).
 * A roll whose number was taken in the meantime is given the next free one;
 * one that can't be made is skipped, with its scans, and the rest go on.
 * `stop` is asked before each roll and scan: once it says so, nothing more
 * is started and what's done stays.
 */
export async function importRolls(
  api: ApiClient,
  rolls: readonly RollToImport[],
  pattern: RollNumberPattern,
  progress: (roll: number, done: number) => void,
  stop: () => boolean,
): Promise<ImportResult[]> {
  const results: ImportResult[] = [];
  const used: string[] = [];
  for (const [index, entry] of rolls.entries()) {
    if (stop()) {
      results.push(
        ...rolls
          .slice(index)
          .map((r) => ({ kind: 'not-started' as const, name: r.folder.name })),
      );
      return results;
    }
    progress(index, 0);
    const name = rollNameOf(entry.folder);
    let number = entry.number;
    let made: Roll | undefined;
    let reason = "the service didn't make it";
    for (
      let attempt = 0;
      attempt < attempts && made === undefined;
      attempt += 1
    ) {
      const created = await api.POST('/api/rolls', {
        body: { roll: number, name, shot: entry.shot },
      });
      if (created.data !== undefined) {
        made = created.data;
        break;
      }
      if (created.response.status !== 409) {
        break;
      }
      // Taken since the preview: the next free one, counting what's been made.
      reason = `roll ${number} already exists`;
      const listing = await api.GET('/api/rolls');
      const next = suggestImportedNumber(
        pattern,
        { shot: entry.shot, event: null },
        [
          ...occupiedLabels(
            (listing.data?.rolls ?? []).map((r) => r.roll),
            (listing.data?.unreadable ?? []).map((u) => u.folder),
          ),
          ...used,
          number,
        ],
      );
      if (next === undefined) {
        break;
      }
      number = next;
    }
    if (made === undefined) {
      results.push({ kind: 'failed', name: entry.folder.name, reason });
      continue;
    }
    used.push(number);
    const report = await uploadScans(
      api,
      made,
      entry.folder.scans,
      (done) => {
        progress(index, done);
      },
      stop,
    );
    results.push({
      kind: 'imported',
      id: made.id,
      number,
      name,
      shot: entry.shot,
      placeholder: entry.placeholder,
      report,
    });
  }
  return results;
}
