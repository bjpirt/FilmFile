import { readFile, rename, writeFile } from 'node:fs/promises';
import { z } from 'zod';

/** What the app remembers on this computer, not in the archive (D52). */
export interface DesktopSettings {
  /** The archive's folder, as chosen (U83). */
  readonly archive?: string;
}

const settingsFile = z.object({ archive: z.string().min(1).optional() });

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
  if (!parsed.success || parsed.data.archive === undefined) {
    return {};
  }
  return { archive: parsed.data.archive };
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
