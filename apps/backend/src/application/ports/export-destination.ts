/** A folder files may be written into, which the person chose. */
export interface ExportFolder {
  /** Where the folder is, for saying so. */
  readonly path: string;
  /**
   * Writes a file at `relativePath` (made of names joined with `/`, its
   * folders made as needed) and returns the path it was written at. A file is
   * written whole or not at all, and nothing already there is replaced or
   * changed: a name that's taken gets `-2`, `-3` after it.
   */
  write(relativePath: string, bytes: Uint8Array): Promise<string>;
}

/**
 * Where an export of several frames goes when the person chooses a folder
 * rather than downloads a zip (D100): only the desktop app can ask, with its
 * own folder chooser, so a page can't have a file written anywhere.
 */
export interface ExportDestination {
  /** Asks for a folder; undefined if the person cancels. */
  choose(): Promise<ExportFolder | undefined>;
  /** Says an export is finished, so the person is told where it went. */
  finished(result: {
    readonly folder: string;
    readonly written: number;
    readonly leftOut: number;
  }): void;
}
