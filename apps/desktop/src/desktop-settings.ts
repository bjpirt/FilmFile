import { readFile, rename, writeFile } from 'node:fs/promises';
import { z } from 'zod';

/** What the app remembers on this computer, not in the archive (D52). */
export interface DesktopSettings {
  /** The FilmFile folder, as chosen (FF-105). */
  readonly folder?: string;
  /** The folder a download was last saved to (FF-166). */
  readonly downloadFolder?: string;
  /** The folder an export of several frames was last written into (FF-176). */
  readonly exportFolder?: string;
  /** This computer's sync settings, kept here for the service (D120). */
  readonly sync?: SyncSettings;
}

/** This computer's bucket, name and last finished sync (D120), each null until set. */
export interface SyncSettings {
  readonly bucket: string | null;
  readonly computerName: string | null;
  readonly lastSync: { readonly sync: number; readonly at: string } | null;
}

/** What the service sends to be kept, and what's kept: checked, since it crosses from another process. */
export const syncSettings = z.object({
  bucket: z.string().min(1).nullable(),
  computerName: z.string().min(1).nullable(),
  lastSync: z
    .object({ sync: z.number().int().min(0), at: z.string() })
    .nullable(),
});

// An `archive` from before the FilmFile folder isn't read: the folder is chosen again.
const settingsFile = z.object({
  folder: z.string().min(1).optional(),
  downloadFolder: z.string().min(1).optional(),
  exportFolder: z.string().min(1).optional(),
  // Sync settings that can't be read are set up again, not the rest lost.
  sync: syncSettings.optional().catch(undefined),
});

/** The settings saved in `file`, or none if it isn't there or can't be read. */
export async function readSettings(file: string): Promise<DesktopSettings> {
  let text: string;
  try {
    text = await readFile(file, 'utf8');
  } catch {
    return {};
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    // Settings only save a choice, made again by asking.
    return {};
  }
  const parsed = settingsFile.safeParse(json);
  if (!parsed.success) {
    return {};
  }
  const { folder, downloadFolder, exportFolder, sync } = parsed.data;
  // An `archive` from before the FilmFile folder says nothing, but a download folder still stands.
  return {
    ...(folder === undefined ? {} : { folder }),
    ...(downloadFolder === undefined ? {} : { downloadFolder }),
    ...(exportFolder === undefined ? {} : { exportFolder }),
    ...(sync === undefined ? {} : { sync }),
  };
}

/** Saves the settings to `file` in one step, so a crash never leaves half a file. */
export async function saveSettings(
  file: string,
  settings: DesktopSettings,
): Promise<void> {
  const temporary = `${file}.tmp`;
  await writeFile(temporary, `${JSON.stringify(settings, null, 2)}\n`);
  await rename(temporary, file);
}

/** Changes some of the settings saved in `file`, keeping the rest. */
export async function updateSettings(
  file: string,
  change: DesktopSettings,
): Promise<void> {
  await saveSettings(file, { ...(await readSettings(file)), ...change });
}
