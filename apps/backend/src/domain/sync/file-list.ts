import type { ManifestEntry } from './manifest.ts';

/** How many paths a list of files shows; the rest are counted (FF-238). */
export const pathsShown = 50;

/** Some files, as the page lists them: how many, their size, and the first paths. */
export interface FileList {
  readonly files: number;
  readonly bytes: number;
  readonly paths: readonly string[];
  /** How many more there are than `paths` gives. */
  readonly more: number;
}

/** The files as a list to show, or null when there are none. */
export function fileListOf(files: readonly ManifestEntry[]): FileList | null {
  if (files.length === 0) {
    return null;
  }
  return {
    files: files.length,
    bytes: files.reduce((total, file) => total + file.size, 0),
    paths: files.slice(0, pathsShown).map((file) => file.path),
    more: Math.max(0, files.length - pathsShown),
  };
}
