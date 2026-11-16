import { readFile } from 'node:fs/promises';
import type {
  ComputerSyncSettings,
  SyncSettingsStore,
} from '../../../application/ports/sync-settings-store.ts';
import {
  computerSyncSettings,
  noSyncSettings,
} from '../node/computer-sync-settings.ts';
import { hasErrorCode } from './error-codes.ts';
import { writeAtomically } from './write-atomically.ts';

/**
 * This computer's sync settings in a JSON file of their own, named by
 * `FILMFILE_SYNC_SETTINGS`: for tests, where there's no desktop app to keep
 * them (D120). Never in the FilmFile folder.
 */
export class FileSyncSettings implements SyncSettingsStore {
  readonly #file: string;

  constructor(file: string) {
    this.#file = file;
  }

  async get(): Promise<ComputerSyncSettings> {
    let text: string;
    try {
      text = await readFile(this.#file, 'utf8');
    } catch (error) {
      if (hasErrorCode(error, 'ENOENT')) {
        return noSyncSettings;
      }
      throw error;
    }
    return computerSyncSettings.parse(JSON.parse(text));
  }

  async save(settings: ComputerSyncSettings): Promise<void> {
    await writeAtomically(this.#file, `${JSON.stringify(settings, null, 2)}\n`);
  }
}
