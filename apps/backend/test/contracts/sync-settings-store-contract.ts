import { describe, expect, test } from 'vitest';
import type { SyncSettingsStore } from '../../src/application/ports/sync-settings-store.ts';

/** What every SyncSettingsStore must do, run against each adapter. */
export function syncSettingsStoreContract(
  name: string,
  make: () => Promise<SyncSettingsStore>,
): void {
  describe(`${name} meets the SyncSettingsStore contract`, () => {
    test('has nothing set at first', async () => {
      const store = await make();

      expect(await store.get()).toEqual({
        bucket: null,
        computerName: null,
        lastSync: null,
      });
    });

    test('gives back what was saved, and a second save replaces it', async () => {
      const store = await make();
      await store.save({
        bucket: 'backup-pirt',
        computerName: 'Studio',
        lastSync: null,
      });
      const saved = {
        bucket: 'backup-pirt',
        computerName: 'Studio',
        lastSync: { sync: 3, at: '2026-11-16T14:02:00.000Z' },
      };
      await store.save(saved);

      expect(await store.get()).toEqual(saved);
    });
  });
}
