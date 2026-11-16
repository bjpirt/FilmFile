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

export const syncProgress = z
  .object({
    state: z.enum(['running', 'done', 'cancelled', 'failed']),
    bytesDone: z.number().int(),
    bytesTotal: z.number().int(),
    filesDone: z.number().int(),
    filesTotal: z.number().int(),
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
    lastSyncedAt: z.iso.datetime().nullable(),
    run: syncProgress.nullable().meta({
      description:
        'How the latest sync since the service started went, if there was one.',
    }),
  })
  .meta({ id: 'SyncStatus' });

export type SyncSettings = z.infer<typeof syncSettings>;
export type SyncProgress = z.infer<typeof syncProgress>;
export type SyncStatus = z.infer<typeof syncStatus>;
