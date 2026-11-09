import {
  entriesIn,
  fileOf,
  isScan,
  scansIn,
  type Drop,
  type DroppedEntry,
} from './dropped-files.ts';

/** A folder to be imported as a roll: its name and the scans directly inside it. */
export interface ImportFolder {
  readonly name: string;
  readonly scans: readonly File[];
}

/** What a folder or folders chosen hold (FF-154): rolls to import, and folders with no scans. */
export interface FoundFolders {
  readonly folders: readonly ImportFolder[];
  /** Names of folders that hold no scans. */
  readonly skipped: readonly string[];
}

function byName(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true });
}

function sorted(found: FoundFolders): FoundFolders {
  return {
    folders: [...found.folders].sort((a, b) => byName(a.name, b.name)),
    skipped: [...found.skipped].sort(byName),
  };
}

/**
 * The roll folders in the folders dropped, which can be one folder of roll
 * folders or several roll folders at once. A folder with JPEGs of its own
 * is a roll; one without is a folder of rolls, each subfolder with a JPEG
 * being one (D90). Call it during the drop event, as `droppedFiles`.
 */
export async function foldersFromDrop(drop: Drop): Promise<FoundFolders> {
  const dropped: DroppedEntry[] = Array.from(drop.items ?? [])
    .filter((item) => item.kind === 'file')
    .map((item) => item.webkitGetAsEntry())
    .filter((entry) => entry !== null)
    .filter((entry) => entry.createReader !== undefined);
  const folders: ImportFolder[] = [];
  const skipped: string[] = [];
  for (const entry of dropped) {
    const inside = await entriesIn(entry);
    const own: File[] = [];
    for (const file of inside.filter(
      (e) => e.createReader === undefined && isScan(e.name),
    )) {
      const read = await fileOf(file);
      if (read !== undefined) {
        own.push(read);
      }
    }
    if (own.length > 0) {
      folders.push({ name: entry.name, scans: own });
      continue;
    }
    let found = false;
    for (const sub of inside.filter((e) => e.createReader !== undefined)) {
      const scans = await scansIn(sub);
      if (scans.length === 0) {
        skipped.push(sub.name);
      } else {
        found = true;
        folders.push({ name: sub.name, scans });
      }
    }
    if (!found && inside.every((e) => e.createReader === undefined)) {
      skipped.push(entry.name);
    }
  }
  return sorted({ folders, skipped });
}

/**
 * The roll folders in a folder chosen with the folder picker, whose files
 * come with their paths (`chosen/roll A/12340001.jpg`): the folder itself if
 * it holds JPEGs, else each of its subfolders that does.
 */
export function foldersFromPicker(files: readonly File[]): FoundFolders {
  const subfolders = new Map<string, File[]>();
  const own: File[] = [];
  let chosen = '';
  for (const file of files) {
    const [root, folder, name, deeper] = file.webkitRelativePath.split('/');
    chosen = root ?? chosen;
    if (folder === undefined) {
      continue;
    }
    if (name === undefined) {
      // `chosen/12340001.jpg`: a file straight in the folder chosen.
      if (isScan(folder)) {
        own.push(file);
      }
      continue;
    }
    if (deeper !== undefined) {
      continue;
    }
    const held = subfolders.get(folder) ?? [];
    if (isScan(name)) {
      held.push(file);
    }
    subfolders.set(folder, held);
  }
  if (own.length > 0) {
    return { folders: [{ name: chosen, scans: own }], skipped: [] };
  }
  const folders: ImportFolder[] = [];
  const skipped: string[] = [];
  for (const [name, scans] of subfolders) {
    if (scans.length === 0) {
      skipped.push(name);
    } else {
      folders.push({ name, scans });
    }
  }
  return sorted({ folders, skipped });
}
