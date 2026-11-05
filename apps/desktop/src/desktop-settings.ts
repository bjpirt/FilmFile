import { readFile, rename, writeFile } from 'node:fs/promises';
import { z } from 'zod';

/** What the app remembers on this computer, not in the archive (D52). */
export interface DesktopSettings {
  /** The FilmFile folder, as chosen (FF-105). */
  readonly folder?: string;
}

// An `archive` from before the FilmFile folder isn't read: the folder is chosen again.
const settingsFile = z.object({ folder: z.string().min(1).optional() });

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
  if (!parsed.success || parsed.data.folder === undefined) {
    return {};
  }
  return { folder: parsed.data.folder };
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
