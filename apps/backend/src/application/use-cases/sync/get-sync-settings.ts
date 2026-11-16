import type { SyncSettingsStore } from '../../ports/sync-settings-store.ts';

/** This computer's sync settings as the page shows them (D120). */
export interface SyncSettingsView {
  /** Whether sync can be set up here: only in the desktop app (or with the test file). */
  readonly available: boolean;
  readonly bucket: string | null;
  /** The name saved, or this computer's own until one is. */
  readonly computerName: string | null;
  /** When this computer last finished a sync, an ISO 8601 time. */
  readonly lastSyncedAt: string | null;
}

/** This computer's sync settings, or that sync isn't available here. */
export class GetSyncSettings {
  readonly #store: SyncSettingsStore | undefined;
  readonly #thisComputer: string;

  constructor(store: SyncSettingsStore | undefined, thisComputer: string) {
    this.#store = store;
    this.#thisComputer = thisComputer;
  }

  async execute(): Promise<SyncSettingsView> {
    if (this.#store === undefined) {
      return {
        available: false,
        bucket: null,
        computerName: null,
        lastSyncedAt: null,
      };
    }
    const { bucket, computerName, lastSync } = await this.#store.get();
    return {
      available: true,
      bucket,
      computerName: computerName ?? this.#thisComputer,
      lastSyncedAt: lastSync?.at ?? null,
    };
  }
}
