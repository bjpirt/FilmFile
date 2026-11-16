/** This computer's sync settings (D120): its bucket, its name, and its last finished sync. */
export interface ComputerSyncSettings {
  /** The bucket the library is synced with, or null until one is chosen. */
  readonly bucket: string | null;
  /** The name other computers are told, or null until one is saved. */
  readonly computerName: string | null;
  /** The last sync this computer finished: its number and when. */
  readonly lastSync: { readonly sync: number; readonly at: string } | null;
}

/**
 * Where this computer's sync settings are kept, never in the FilmFile folder
 * (D52, D120): by the desktop app, asked over its private channel, or a file
 * named by `FILMFILE_SYNC_SETTINGS` for tests. With neither, there is none,
 * and sync isn't offered.
 */
export interface SyncSettingsStore {
  /** The settings, each null until it's saved. */
  get(): Promise<ComputerSyncSettings>;
  /** Replaces the settings. */
  save(settings: ComputerSyncSettings): Promise<void>;
}
