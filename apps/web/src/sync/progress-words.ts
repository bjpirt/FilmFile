import type { SyncProgress } from '@filmfile/contracts/sync';
import { formatBytes } from '../settings/format-bytes.ts';

/** A count as people read it: "1,200". */
export const count = (n: number) => n.toLocaleString('en-GB');

/** "1 file", "2,340 files". */
export const files = (n: number) => `${count(n)} ${n === 1 ? 'file' : 'files'}`;

/**
 * What a running sync is doing, in words (FF-241): checking the library,
 * checking the bucket, then uploading. A first sync counts the whole library;
 * a later one only its own upload.
 */
export function progressWords(run: SyncProgress): string {
  switch (run.phase) {
    case 'checking-library':
      return run.filesToCheck === 0
        ? 'Checking the library…'
        : `Checking the library… ${count(run.filesChecked)} of ${files(run.filesToCheck)}`;
    case 'checking-bucket':
      return 'Checking the bucket…';
    case 'uploading':
      return run.library === null
        ? `Uploading ${formatBytes(run.bytesDone)} of ${formatBytes(run.bytesTotal)} (${count(run.filesDone)} of ${files(run.filesTotal)})`
        : `Backed up ${formatBytes(run.library.bytesBackedUp)} of ${formatBytes(run.library.bytes)} (${count(run.library.filesBackedUp)} of ${files(run.library.files)})`;
  }
}
