import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach } from 'vitest';
import { FileSyncSettings } from '../../src/adapters/outbound/filesystem/file-sync-settings.ts';
import { InMemorySyncSettings } from '../../src/adapters/outbound/memory/in-memory-sync-settings.ts';
import type { ParentChannel } from '../../src/adapters/outbound/node/parent-process-export-destination.ts';
import { ParentProcessSyncSettings } from '../../src/adapters/outbound/node/parent-process-sync-settings.ts';
import { syncSettingsStoreContract } from './sync-settings-store-contract.ts';

const folders: string[] = [];

afterEach(async () => {
  await Promise.all(
    folders.splice(0).map((folder) => rm(folder, { recursive: true })),
  );
});

/** A desktop app at the other end of the channel, keeping the settings as it does: in memory here, answering each ask. */
function aDesktopApp(): ParentChannel {
  let kept: unknown = {};
  const listeners: ((message: { data: unknown }) => void)[] = [];
  return {
    on: (_event, listener) => {
      listeners.push(listener);
    },
    postMessage: (message: unknown) => {
      if (
        typeof message !== 'object' ||
        message === null ||
        !('type' in message) ||
        !('id' in message)
      ) {
        return;
      }
      const { type, id } = message;
      if (type === 'save-sync-settings' && 'settings' in message) {
        kept = message.settings;
      }
      const answer =
        type === 'get-sync-settings'
          ? { type: 'sync-settings', id, settings: kept }
          : type === 'save-sync-settings'
            ? { type: 'sync-settings-saved', id }
            : undefined;
      if (answer !== undefined) {
        // Answered later, as a message from another process is.
        setTimeout(() => {
          for (const listener of listeners) {
            listener({ data: answer });
          }
        }, 0);
      }
    },
  };
}

syncSettingsStoreContract('InMemorySyncSettings', () =>
  Promise.resolve(new InMemorySyncSettings()),
);

syncSettingsStoreContract('FileSyncSettings', async () => {
  const folder = await mkdtemp(path.join(tmpdir(), 'filmfile-sync-settings-'));
  folders.push(folder);
  return new FileSyncSettings(path.join(folder, 'sync.json'));
});

syncSettingsStoreContract('ParentProcessSyncSettings', () =>
  Promise.resolve(new ParentProcessSyncSettings(aDesktopApp())),
);
