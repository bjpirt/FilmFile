/** What the desktop app does for the service when it's asked (D100). */
export interface ServiceRequests {
  /** Shows the folder chooser; undefined if the person cancels. */
  readonly chooseExportFolder: () => Promise<string | undefined>;
  /** Says where an export went and how many files were written or left out. */
  readonly exportFinished: (result: {
    readonly folder: string;
    readonly written: number;
    readonly leftOut: number;
  }) => void;
}

/**
 * Answers a message from the service: a request for a folder to export into,
 * answered with `{ type: 'export-folder', id, folder }` (the folder null when
 * cancelled), or the news that an export is finished. Anything else is
 * ignored. `reply` sends back to the service.
 */
export async function handleServiceMessage(
  message: unknown,
  requests: ServiceRequests,
  reply: (answer: unknown) => void,
): Promise<void> {
  if (typeof message !== 'object' || message === null || !('type' in message)) {
    return;
  }
  if (
    message.type === 'choose-export-folder' &&
    'id' in message &&
    typeof message.id === 'number'
  ) {
    const folder = await requests.chooseExportFolder();
    reply({ type: 'export-folder', id: message.id, folder: folder ?? null });
    return;
  }
  if (
    message.type === 'export-finished' &&
    'folder' in message &&
    typeof message.folder === 'string' &&
    'written' in message &&
    typeof message.written === 'number' &&
    'leftOut' in message &&
    typeof message.leftOut === 'number'
  ) {
    requests.exportFinished({
      folder: message.folder,
      written: message.written,
      leftOut: message.leftOut,
    });
  }
}

/** How an export's end is told: "Saved 10 files to /Users/ben/Pictures", and what was left out. */
export function exportFinishedMessage(result: {
  readonly folder: string;
  readonly written: number;
  readonly leftOut: number;
}): { readonly message: string; readonly detail?: string } {
  const files =
    result.written === 1 ? '1 file' : `${String(result.written)} files`;
  const left =
    result.leftOut === 1
      ? '1 frame was'
      : `${String(result.leftOut)} frames were`;
  return {
    message: `Saved ${files} to ${result.folder}`,
    ...(result.leftOut === 0
      ? {}
      : {
          detail: `${left} left out; skipped.txt in the folder says which and why.`,
        }),
  };
}
