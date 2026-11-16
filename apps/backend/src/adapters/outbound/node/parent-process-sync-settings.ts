import type {
  ComputerSyncSettings,
  SyncSettingsStore,
} from '../../../application/ports/sync-settings-store.ts';
import { computerSyncSettings } from './computer-sync-settings.ts';
import type { ParentChannel } from './parent-process-export-destination.ts';

/**
 * This computer's sync settings, kept by the desktop app that started the
 * service with its other settings for this computer (D120), and asked for
 * over the private channel between the two: `{ type: 'get-sync-settings',
 * id }` is answered `{ type: 'sync-settings', id, settings }`, and `{ type:
 * 'save-sync-settings', id, settings }` with `{ type: 'sync-settings-saved',
 * id }`.
 */
export class ParentProcessSyncSettings implements SyncSettingsStore {
  readonly #parent: ParentChannel;
  readonly #waiting = new Map<number, (data: object) => void>();
  #next = 0;

  constructor(parent: ParentChannel) {
    this.#parent = parent;
    parent.on('message', ({ data }) => {
      if (
        typeof data === 'object' &&
        data !== null &&
        'type' in data &&
        (data.type === 'sync-settings' ||
          data.type === 'sync-settings-saved') &&
        'id' in data &&
        typeof data.id === 'number'
      ) {
        const answer = this.#waiting.get(data.id);
        this.#waiting.delete(data.id);
        answer?.(data);
      }
    });
  }

  /** The settings kept by the desktop app that started the service, or none when there's no app to ask. */
  static ofThisProcess(): ParentProcessSyncSettings | undefined {
    const parent: unknown = Reflect.get(process, 'parentPort');
    return isChannel(parent)
      ? new ParentProcessSyncSettings(parent)
      : undefined;
  }

  #ask(message: Record<string, unknown>): Promise<object> {
    this.#next += 1;
    const id = this.#next;
    return new Promise((resolve) => {
      this.#waiting.set(id, resolve);
      this.#parent.postMessage({ ...message, id });
    });
  }

  async get(): Promise<ComputerSyncSettings> {
    const answer = await this.#ask({ type: 'get-sync-settings' });
    return computerSyncSettings.parse(
      'settings' in answer ? answer.settings : {},
    );
  }

  async save(settings: ComputerSyncSettings): Promise<void> {
    await this.#ask({ type: 'save-sync-settings', settings });
  }
}

function isChannel(value: unknown): value is ParentChannel {
  return (
    typeof value === 'object' &&
    value !== null &&
    'postMessage' in value &&
    typeof value.postMessage === 'function' &&
    'on' in value &&
    typeof value.on === 'function'
  );
}
