import { createHash } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import {
  frameFolderName,
  versionFolderName,
} from '../../../domain/rolls/folder-names.ts';
import type { Frame, Roll, Version } from '../../../domain/rolls/roll.ts';
import { exists, isDirectory, removeIfEmpty } from './folder-checks.ts';
import { rollFileContent } from './roll-file.ts';
import { safePath } from './safe-path.ts';
import type { StoredRoll } from './stored-roll.ts';
import { writeAtomically } from './write-atomically.ts';

/** A version token: the SHA-256 of the file's bytes. */
function versionOf(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

interface VersionFolderMove {
  readonly from: string;
  readonly to: string;
}

function versionFilePath(
  frame: Frame,
  version: Version,
  previousFile: string,
): string {
  return path.posix.join(
    'frames',
    frameFolderName(frame.number, frame.id),
    versionFolderName(version.kind, version.id),
    path.posix.basename(previousFile),
  );
}

function withChangedVersionPaths(before: Roll, after: Roll): Roll {
  const beforeFrames = new Map(before.frames.map((frame) => [frame.id, frame]));
  return {
    ...after,
    frames: after.frames.map((frame) => {
      const previousFrame = beforeFrames.get(frame.id);
      if (previousFrame === undefined) {
        return frame;
      }
      const numberChanged = previousFrame.number !== frame.number;
      return {
        ...frame,
        versions: frame.versions.map((version) => {
          const previousVersion = previousFrame.versions.find(
            (previous) => previous.id === version.id,
          );
          if (
            previousVersion === undefined ||
            (!numberChanged && previousVersion.kind === version.kind)
          ) {
            return version;
          }
          return {
            ...version,
            file: versionFilePath(frame, version, previousVersion.file),
          };
        }),
      };
    }),
  };
}

function versionFolderMoves(
  before: Roll,
  after: Roll,
  rollFolder: string,
): VersionFolderMove[] {
  const beforeFrames = new Map(before.frames.map((frame) => [frame.id, frame]));
  const moves: VersionFolderMove[] = [];
  for (const frame of after.frames) {
    const previousFrame = beforeFrames.get(frame.id);
    if (previousFrame === undefined) {
      continue;
    }
    for (const version of frame.versions) {
      const previousVersion = previousFrame.versions.find(
        (previous) => previous.id === version.id,
      );
      if (previousVersion === undefined) {
        continue;
      }
      const from = path.posix.dirname(previousVersion.file);
      const to = path.posix.dirname(version.file);
      if (from === to) {
        continue;
      }
      const expected = path.posix.join(
        'frames',
        frameFolderName(previousFrame.number, previousFrame.id),
        versionFolderName(previousVersion.kind, previousVersion.id),
      );
      if (from !== expected) {
        throw new Error(
          'version path does not match the supported folder layout',
        );
      }
      moves.push({
        from: safePath(rollFolder, ...from.split('/')),
        to: safePath(rollFolder, ...to.split('/')),
      });
    }
  }
  return moves;
}

/**
 * Saves a roll whose frames or versions changed: moves the version folders
 * whose names follow a frame number or version kind, then writes roll.json.
 * If any step fails, the moves are undone, and a rollback that can't finish
 * is reported with the error that caused it (D78).
 */
export async function moveVersionFolders(input: {
  readonly current: StoredRoll;
  readonly roll: Roll;
  readonly renameFolder: (source: string, destination: string) => Promise<void>;
}): Promise<{ readonly content: string; readonly version: string }> {
  const { current, roll, renameFolder } = input;
  const updated = withChangedVersionPaths(current.roll, roll);
  const content = rollFileContent(updated);
  const moves = versionFolderMoves(
    current.roll,
    updated,
    path.dirname(current.file),
  );
  const destinations = new Set<string>();
  for (const move of moves) {
    if (destinations.has(move.to)) {
      throw new Error('multiple versions use the same destination folder');
    }
    destinations.add(move.to);
    if (!(await isDirectory(move.from))) {
      throw new Error('version source folder is missing');
    }
    if (await exists(move.to)) {
      throw new Error('version destination folder already exists');
    }
  }

  const moved: VersionFolderMove[] = [];
  try {
    for (const move of moves) {
      await mkdir(path.dirname(move.to), { recursive: true });
      await renameFolder(move.from, move.to);
      moved.push(move);
    }
    for (const folder of new Set(
      moves.map((move) => path.dirname(move.from)),
    )) {
      await removeIfEmpty(folder);
    }
    await writeAtomically(current.file, content);
  } catch (error) {
    const rollbackErrors: unknown[] = [];
    for (const move of [...moved].reverse()) {
      try {
        await mkdir(path.dirname(move.from), { recursive: true });
        await renameFolder(move.to, move.from);
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
      }
    }
    for (const move of moved) {
      try {
        await removeIfEmpty(path.dirname(move.to));
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
      }
    }
    if (rollbackErrors.length > 0) {
      throw new AggregateError(
        [error, ...rollbackErrors],
        'version folder save failed and rollback was incomplete',
        { cause: error },
      );
    }
    throw error;
  }
  return { content, version: versionOf(content) };
}
