import { z } from 'zod';
import type { ComputerSyncSettings } from '../../../application/ports/sync-settings-store.ts';

/** This computer's sync settings as they're kept and sent: each part null until it's set. */
export const computerSyncSettings = z.object({
  bucket: z.string().min(1).nullable().default(null),
  computerName: z.string().min(1).nullable().default(null),
  lastSync: z
    .object({ sync: z.number().int().min(0), at: z.string() })
    .nullable()
    .default(null),
});

export const noSyncSettings: ComputerSyncSettings = {
  bucket: null,
  computerName: null,
  lastSync: null,
};
