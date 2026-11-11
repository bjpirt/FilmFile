const key = 'filmfile.exportChoices';

/** How the last export was made; what the dialog starts with. */
export interface ExportChoices {
  /** The longest edge in pixels, or null for the full size. */
  readonly size: number | null;
  /** JPEG quality, 1 to 100. */
  readonly quality: number;
  /** What the file says about the frame: everything known, or only who it's by. */
  readonly metadata: Metadata;
  /** For a zip: where the files go. */
  readonly layout: Layout;
  /** For a zip: how the files are named, with `{roll}`, `{frame}`, `{title}`, `{year}` and `{original}`. */
  readonly fileNames: string;
}

export type Layout = 'flat' | 'roll-folder' | 'year-roll';

export const layoutChoices: readonly { value: Layout; label: string }[] = [
  { value: 'flat', label: 'Flat' },
  { value: 'roll-folder', label: 'A folder per roll' },
  { value: 'year-roll', label: 'Year then roll' },
];

/** What a single frame is named by, and a zip's files first. */
export const defaultFileNames = '{roll}-{frame}';

export type Metadata = 'everything' | 'author-and-copyright';

export const metadataChoices: readonly { value: Metadata; label: string }[] = [
  { value: 'everything', label: 'Everything known about the frame' },
  { value: 'author-and-copyright', label: 'Only author and copyright' },
];

/** The sizes the dialog offers, besides the full size. */
export const sizes: readonly number[] = [1024, 2048, 4096];

const firstTime: ExportChoices = {
  size: 2048,
  quality: 90,
  metadata: 'everything',
  layout: 'flat',
  fileNames: defaultFileNames,
};

/** The size and quality last chosen, kept in the browser as a convenience (D95). */
export function rememberedExportChoices(): ExportChoices {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(key) ?? 'null');
    if (typeof stored !== 'object' || stored === null) {
      return firstTime;
    }
    const size = 'size' in stored ? stored.size : undefined;
    const quality = 'quality' in stored ? stored.quality : undefined;
    const metadata = 'metadata' in stored ? stored.metadata : undefined;
    const layout = 'layout' in stored ? stored.layout : undefined;
    const fileNames = 'fileNames' in stored ? stored.fileNames : undefined;
    return {
      size:
        size === null || (typeof size === 'number' && sizes.includes(size))
          ? size
          : firstTime.size,
      quality: isQuality(quality) ? quality : firstTime.quality,
      metadata:
        metadataChoices.find((choice) => choice.value === metadata)?.value ??
        firstTime.metadata,
      layout:
        layoutChoices.find((choice) => choice.value === layout)?.value ??
        firstTime.layout,
      fileNames:
        typeof fileNames === 'string' && fileNames !== ''
          ? fileNames
          : firstTime.fileNames,
    };
  } catch {
    return firstTime;
  }
}

export function rememberExportChoices(choices: ExportChoices): void {
  try {
    localStorage.setItem(key, JSON.stringify(choices));
  } catch {
    // Not remembered this time; the export still works.
  }
}

/** Whether a value is a whole number from 1 to 100. */
export function isQuality(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 100
  );
}
