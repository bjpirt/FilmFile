import path from 'node:path';

/** The part of Electron's download a save needs, so it can be tested without Electron. */
export interface Download {
  getFilename(): string;
  /** Where the system's save dialog starts, with the name suggested. */
  setSaveDialogOptions(options: { readonly defaultPath: string }): void;
  /** The path chosen in the dialog, once it has been. */
  getSavePath(): string;
  once(
    event: 'done',
    listener: (
      event: unknown,
      state: 'completed' | 'cancelled' | 'interrupted',
    ) => void,
  ): unknown;
}

/**
 * A download in the desktop app asks where to save it (FF-166, D95), with the
 * computer's own save dialog: it starts in the folder last saved to (the
 * Downloads folder the first time), suggesting the name the service gave. The
 * service is never told a path, so a page can't have a file saved anywhere.
 * `saved` hears of the file once it's there; cancelling the dialog cancels the
 * download, and nothing is remembered or said.
 */
export function handleDownload(
  download: Download,
  {
    lastFolder,
    downloads,
    saved,
  }: {
    readonly lastFolder: () => string | undefined;
    readonly downloads: string;
    readonly saved: (file: string) => void;
  },
): void {
  download.setSaveDialogOptions({
    defaultPath: path.join(lastFolder() ?? downloads, download.getFilename()),
  });
  download.once('done', (_event, state) => {
    if (state === 'completed') {
      saved(download.getSavePath());
    }
  });
}
