import type {
  ComputerSyncSettings,
  SyncSettingsStore,
} from '../../../application/ports/sync-settings-store.ts';

/** This computer's sync settings in memory, for tests. */
export class InMemorySyncSettings implements SyncSettingsStore {
  settings: ComputerSyncSettings = {
    bucket: null,
    computerName: null,
    lastSync: null,
  };

  get(): Promise<ComputerSyncSettings> {
    return Promise.resolve(this.settings);
  }

  save(settings: ComputerSyncSettings): Promise<void> {
    this.settings = settings;
    return Promise.resolve();
  }
}
