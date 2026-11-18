import type { SyncProgress } from '@filmfile/contracts/sync';
import { expect, test } from 'vitest';
import { doneWords } from './done-words.ts';

const done = (change: Partial<SyncProgress>): SyncProgress => ({
  state: 'done',
  phase: 'uploading',
  filesChecked: 0,
  filesToCheck: 0,
  bytesDone: 0,
  bytesTotal: 0,
  filesDone: 0,
  filesTotal: 0,
  filesCopied: 0,
  filesRemoved: 0,
  toRemove: null,
  missing: null,
  first: false,
  library: null,
  secondsLeft: null,
  failure: null,
  message: null,
  ...change,
});

test.each([
  [{}, 'Nothing had changed.'],
  [{ filesDone: 12, bytesDone: 1_200_000_000 }, 'Sent 12 files (1.2 GB).'],
  [{ filesDone: 1, filesCopied: 1 }, 'Copied 1 renamed file.'],
  [{ filesRemoved: 3 }, 'Removed 3 files from the backup.'],
  [
    { filesDone: 36, filesCopied: 36, filesRemoved: 1 },
    'Copied 36 renamed files and removed 1 file from the backup.',
  ],
  [
    {
      filesDone: 48,
      bytesDone: 1_200_000_000,
      filesCopied: 36,
      filesRemoved: 3,
    },
    'Sent 12 files (1.2 GB), copied 36 renamed files and removed 3 files from the backup.',
  ],
] as const)('a sync that did %o reads "%s"', (change, words) => {
  expect(doneWords(done(change))).toBe(words);
});
