import { syncSettings, type SyncSettings } from './desktop-settings.ts';

const noSyncSettings: SyncSettings = {
  bucket: null,
  computerName: null,
  lastSync: null,
};

/** What the desktop app does for the service when it's asked (D100, D120). */
export interface ServiceRequests {
  /** This computer's sync settings, as kept. */
  readonly syncSettings: () => Promise<SyncSettings | undefined>;
  /** Keeps this computer's sync settings. */
  readonly saveSyncSettings: (settings: SyncSettings) => Promise<void>;
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
 * Answers a message from the service: this computer's sync settings, asked
 * for or to be kept (`{ type: 'sync-settings', id, settings }` and `{ type:
 * 'sync-settings-saved', id }`), a request for a folder to export into,
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
    message.type === 'get-sync-settings' &&
    'id' in message &&
    typeof message.id === 'number'
  ) {
    const settings = (await requests.syncSettings()) ?? noSyncSettings;
    reply({ type: 'sync-settings', id: message.id, settings });
    return;
  }
  if (
    message.type === 'save-sync-settings' &&
    'id' in message &&
    typeof message.id === 'number' &&
    'settings' in message
  ) {
    const settings = syncSettings.safeParse(message.settings);
    // Settings that aren't settings are a bug in the service: kept as they were.
    if (settings.success) {
      await requests.saveSyncSettings(settings.data);
    }
    reply({ type: 'sync-settings-saved', id: message.id });
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
