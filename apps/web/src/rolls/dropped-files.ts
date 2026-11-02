// A drop's `files` list holds a dropped folder as a single, unreadable item.
// Its contents are only reachable through the drop's entries. These types
// cover the parts of the browser's FileSystemEntry API that we use.

/** A dropped file (has `file`) or folder (has `createReader`). */
export interface DroppedEntry {
  readonly name: string;
  readonly file?: (
    success: (file: File) => void,
    failure?: (error: DOMException) => void,
  ) => void;
  readonly createReader?: () => {
    readEntries: (
      success: (entries: DroppedEntry[]) => void,
      failure?: (error: DOMException) => void,
    ) => void;
  };
}

export interface Drop {
  readonly files: ArrayLike<File>;
  readonly items?: ArrayLike<{
    readonly kind: string;
    webkitGetAsEntry: () => DroppedEntry | null;
  }>;
}

// Folders can hold sidecars, contact sheets and system files such as
// .DS_Store and ._12340001.jpg; only the scans are wanted.
function isScan(name: string): boolean {
  return !name.startsWith('.') && /\.jpe?g$/i.test(name);
}

function fileOf(entry: DroppedEntry): Promise<File | undefined> {
  const { file } = entry;
  if (file === undefined) {
    return Promise.resolve(undefined);
  }
  return new Promise((resolve, reject) => {
    file.call(entry, resolve, reject);
  });
}

/** Every entry in a folder: browsers hand them back in batches until an empty one. */
async function entriesIn(entry: DroppedEntry): Promise<DroppedEntry[]> {
  const reader = entry.createReader?.call(entry);
  if (reader === undefined) {
    return [];
  }
  const entries: DroppedEntry[] = [];
  for (;;) {
    const batch = await new Promise<DroppedEntry[]>((resolve, reject) => {
      reader.readEntries(resolve, reject);
    });
    if (batch.length === 0) {
      return entries;
    }
    entries.push(...batch);
  }
}

async function scansIn(folder: DroppedEntry): Promise<File[]> {
  const files = await Promise.all(
    (await entriesIn(folder)).filter((e) => isScan(e.name)).map(fileOf),
  );
  return files.filter((file) => file !== undefined);
}

/**
 * The files dropped, with each dropped folder replaced by the JPEGs directly
 * inside it. Call it during the drop event: the browser empties the drop's
 * items once the event is over.
 */
export function droppedFiles(drop: Drop): Promise<File[]> {
  if (drop.items === undefined || drop.items.length === 0) {
    return Promise.resolve(Array.from(drop.files));
  }
  // A drag from Finder can carry text, such as the folder's URL, alongside the files.
  const entries = Array.from(drop.items)
    .filter((item) => item.kind === 'file')
    .map((item) => item.webkitGetAsEntry())
    .filter((entry) => entry !== null);
  return Promise.all(
    entries.map(async (entry) => {
      if (entry.createReader !== undefined) {
        return scansIn(entry);
      }
      const file = await fileOf(entry);
      return file === undefined ? [] : [file];
    }),
  ).then((groups) => groups.flat());
}
