import { z } from 'zod';

// Only what a sync needs from roll.json, read loosely so that a roll.json of
// another schema version still says which files it holds.
const mentions = z.object({
  frames: z.array(
    z.object({ versions: z.array(z.object({ file: z.string() })) }),
  ),
});

/**
 * The files a roll.json mentions (D117), by path from the FilmFile folder:
 * each version's file, which roll.json gives from the roll's folder. A
 * roll.json that can't be read, or names a file outside its folder, mentions
 * everything in its folder, given as the folder's path ending in `/`, so a
 * sync never takes its files for gone.
 */
export function rollFileMentions(
  rollFile: string,
  text: string,
): readonly string[] {
  const folder = rollFile.slice(0, rollFile.lastIndexOf('/') + 1);
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return [folder];
  }
  const read = mentions.safeParse(json);
  if (!read.success) {
    return [folder];
  }
  const files = read.data.frames.flatMap((frame) =>
    frame.versions.map((version) => version.file),
  );
  const inside = (file: string) =>
    file !== '' &&
    !file.startsWith('/') &&
    !file
      .split('/')
      .some((name) => name === '' || name === '.' || name === '..');
  if (!files.every(inside)) {
    return [folder];
  }
  return files.map((file) => `${folder}${file}`);
}
