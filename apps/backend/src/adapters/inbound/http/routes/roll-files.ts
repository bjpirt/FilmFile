import { glob, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { safePath } from '../../../outbound/filesystem/safe-path.ts';

// Reading and writing roll.json files, until the roll repository replaces this (task H.6).

// Strict, because the roll number becomes part of a folder path.
export const rollNumber = z
  .string()
  .regex(/^\d{4}-\d{3}$/, 'must be a roll number like 2026-014');

const storedVersion = z.object({
  id: z.string(),
  file: z.string(),
  sha256: z.string(),
  bytes: z.number().int(),
  width: z.number().int(),
  height: z.number().int(),
  added: z.string(),
});

const storedFrame = z.object({
  id: z.string(),
  number: z.string().nullable(),
  versions: z.array(storedVersion),
});

const storedRoll = z.object({
  schema: z.literal(1),
  id: z.string(),
  roll: rollNumber,
  frames: z.array(storedFrame),
});

export type StoredVersion = z.infer<typeof storedVersion>;
export type StoredRoll = z.infer<typeof storedRoll>;

export interface RollFile {
  readonly file: string;
  readonly stored: StoredRoll;
}

/** Every roll in the archive, ordered by roll number. */
export async function readRollFiles(archivePath: string): Promise<RollFile[]> {
  const rollFiles: RollFile[] = [];
  for await (const relative of glob('rolls/*/*/roll.json', {
    cwd: archivePath,
  })) {
    const file = safePath(archivePath, ...relative.split(path.sep));
    const stored = storedRoll.parse(JSON.parse(await readFile(file, 'utf8')));
    rollFiles.push({ file, stored });
  }
  return rollFiles.sort((a, b) => a.stored.roll.localeCompare(b.stored.roll));
}

export async function findRollFile(
  archivePath: string,
  id: string,
): Promise<RollFile | undefined> {
  return (await readRollFiles(archivePath)).find((r) => r.stored.id === id);
}

export function rollFileContent(stored: StoredRoll): string {
  return `${JSON.stringify(stored, null, 2)}\n`;
}

export async function writeRollFile(
  file: string,
  stored: StoredRoll,
): Promise<void> {
  await writeFile(file, rollFileContent(stored));
}
