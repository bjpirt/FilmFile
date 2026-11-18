import { z } from 'zod';

// Request and response shapes for backing up and syncing the library (D115–D120).

const failureReason = z.enum([
  'no-account',
  'no-credentials',
  'keys-refused',
  'no-bucket',
  'unreachable',
  'other',
  'not-empty',
  'another-library',
]);

export const syncSettings = z
  .object({
    available: z.boolean().meta({
      description:
        'Whether sync can be set up here: only in the desktop app, which keeps these settings for this computer (D120).',
    }),
    bucket: z.string().nullable().meta({
      description: 'The R2 bucket the library is synced with, or null.',
    }),
    computerName: z.string().nullable().meta({
      description:
        "This computer's name as other computers are told it; its own name until one is saved. Null when sync isn't available.",
    }),
    lastSyncedAt: z.iso.datetime().nullable().meta({
      description: 'When this computer last finished a sync.',
    }),
  })
  .meta({ id: 'SyncSettings' });

export const saveSyncSettingsRequest = z
  .strictObject({
    bucket: z.string().max(100).meta({
      description:
        'An R2 bucket in the Cloudflare account set in Settings, used only for the backup.',
    }),
    computerName: z.string().max(200).meta({
      description: "This computer's name, 1 to 60 characters.",
    }),
  })
  .meta({ id: 'SaveSyncSettingsRequest' });

export const backupFigure = z
  .object({
    bytes: z.number().int(),
    files: z.number().int(),
    bytesBackedUp: z.number().int(),
    filesBackedUp: z.number().int(),
  })
  .meta({
    id: 'BackupFigure',
    description: 'How much of the whole library is in the bucket (FF-241).',
  });

export const fileList = z
  .object({
    files: z.number().int(),
    bytes: z.number().int(),
    paths: z.array(z.string()).readonly().meta({
      description: 'The first 50 files, by path from the FilmFile folder.',
    }),
    more: z.number().int().meta({
      description: 'How many more there are than `paths` gives.',
    }),
  })
  .meta({ id: 'FileList', description: 'Some files, to list (FF-238).' });

export const syncProgress = z
  .object({
    state: z
      .enum(['running', 'waiting', 'stopping', 'done', 'cancelled', 'failed'])
      .meta({
        description:
          '`waiting` for an answer to whether to remove files gone from the library (`POST /api/sync/removals`); `stopping` from a cancel until the uploads going have been cut off.',
      }),
    phase: z.enum(['checking-library', 'checking-bucket', 'uploading']).meta({
      description:
        'Reading the library to see what changed, listing the bucket for what it already has, then uploading.',
    }),
    filesChecked: z.number().int(),
    filesToCheck: z.number().int(),
    bytesDone: z.number().int(),
    bytesTotal: z.number().int(),
    filesDone: z.number().int().meta({
      description: 'Files uploaded or copied, of `filesTotal`.',
    }),
    filesTotal: z.number().int(),
    filesCopied: z.number().int().meta({
      description:
        'Renamed files copied inside the bucket instead of uploaded, among those done.',
    }),
    filesRemoved: z.number().int().meta({
      description: 'Files gone from the library removed from the bucket.',
    }),
    toRemove: fileList.nullable().meta({
      description: 'While waiting, the files the sync would remove.',
    }),
    missing: fileList.nullable().meta({
      description:
        'Files a roll.json mentions that are missing on this computer; the bucket keeps them.',
    }),
    first: z.boolean().meta({
      description:
        'Whether this is the first sync of the library to the bucket, or one carrying it on.',
    }),
    library: backupFigure.nullable().meta({
      description:
        'For a first sync, the whole library and how much is backed up.',
    }),
    secondsLeft: z.number().int().nullable().meta({
      description:
        'About how long the upload has left, once a minute of it has been timed.',
    }),
    failure: failureReason.nullable().meta({
      description: 'Why it failed, if it did.',
    }),
    message: z.string().nullable().meta({
      description: 'What to fix, in words, when it failed.',
    }),
  })
  .meta({ id: 'SyncProgress' });

export const syncStatus = z
  .object({
    available: z.boolean(),
    ready: z.boolean().meta({
      description:
        'Whether a sync can be started: in the desktop app, with the Cloudflare account ID and a bucket set.',
    }),
    lastSyncedAt: z.iso.datetime().nullable(),
    firstSync: backupFigure.nullable().meta({
      description:
        'How far a first sync that didn’t finish got, worked out from the bucket by path and size; null until it’s known, or when there’s none.',
    }),
    run: syncProgress.nullable().meta({
      description:
        'How the latest sync since the service started went, if there was one.',
    }),
  })
  .meta({ id: 'SyncStatus' });

export type SyncSettings = z.infer<typeof syncSettings>;
export const answerRemovalsRequest = z
  .strictObject({
    remove: z.boolean().meta({
      description:
        'true removes the files from the bucket; false keeps them for now, and the next sync asks again.',
    }),
  })
  .meta({ id: 'AnswerRemovalsRequest' });

export type SyncProgress = z.infer<typeof syncProgress>;
export type FileList = z.infer<typeof fileList>;
export type SyncStatus = z.infer<typeof syncStatus>;
export type BackupFigure = z.infer<typeof backupFigure>;
