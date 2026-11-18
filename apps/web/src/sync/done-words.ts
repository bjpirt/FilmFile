import type { SyncProgress } from '@filmfile/contracts/sync';
import { formatBytes } from '../settings/format-bytes.ts';
import { count, files } from './progress-words.ts';

/** "a", "a and b", "a, b and c". */
function inWords(parts: readonly string[]): string {
  const last = parts.at(-1) ?? '';
  return parts.length < 2
    ? last
    : `${parts.slice(0, -1).join(', ')} and ${last}`;
}

/**
 * What a finished sync did, in one line naming only what happened (FF-238):
 * "Sent 12 files (1.2 GB), copied 36 renamed files and removed 3 files from
 * the backup." Copies are among the files done, but sent no bytes.
 */
export function doneWords(run: SyncProgress): string {
  const sent = run.filesDone - run.filesCopied;
  const parts = [
    ...(sent > 0
      ? [`sent ${files(sent)} (${formatBytes(run.bytesDone)})`]
      : []),
    ...(run.filesCopied > 0
      ? [
          `copied ${count(run.filesCopied)} renamed ${run.filesCopied === 1 ? 'file' : 'files'}`,
        ]
      : []),
    ...(run.filesRemoved > 0
      ? [`removed ${files(run.filesRemoved)} from the backup`]
      : []),
  ];
  if (parts.length === 0) {
    return 'Nothing had changed.';
  }
  const words = inWords(parts);
  return `${words.charAt(0).toUpperCase()}${words.slice(1)}.`;
}
