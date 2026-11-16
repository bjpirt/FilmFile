import type { ValidationFailed } from '../../../domain/shared/domain-error.ts';
import {
  bucketNameMessage,
  isBucketName,
} from '../../../domain/shared/bucket-name.ts';
import { err, ok, type Result } from '../../../domain/shared/result.ts';
import { parseComputerName } from '../../../domain/sync/computer-name.ts';
import type { SyncSettingsStore } from '../../ports/sync-settings-store.ts';

/** Sync works only where its settings can be kept: the desktop app (D120). */
export const syncNeedsTheApp: ValidationFailed = {
  kind: 'validation-failed',
  issues: [{ path: ['sync'], message: 'sync works in the FilmFile app' }],
};

/**
 * Saves this computer's bucket and name (D120). A different bucket forgets
 * the last sync, which was another bucket's.
 */
export class SaveSyncSettings {
  readonly #store: SyncSettingsStore | undefined;

  constructor(store: SyncSettingsStore | undefined) {
    this.#store = store;
  }

  async execute(input: {
    readonly bucket: string;
    readonly computerName: string;
  }): Promise<Result<undefined, ValidationFailed>> {
    if (this.#store === undefined) {
      return err(syncNeedsTheApp);
    }
    const bucket = input.bucket.trim();
    const name = parseComputerName(input.computerName);
    const issues = [
      ...(isBucketName(bucket)
        ? []
        : [{ path: ['bucket'], message: bucketNameMessage }]),
      ...(name.ok ? [] : name.error.issues),
    ];
    if (issues.length > 0 || !name.ok) {
      return err({ kind: 'validation-failed', issues });
    }
    const current = await this.#store.get();
    await this.#store.save({
      bucket,
      computerName: name.value,
      lastSync: current.bucket === bucket ? current.lastSync : null,
    });
    return ok(undefined);
  }
}
