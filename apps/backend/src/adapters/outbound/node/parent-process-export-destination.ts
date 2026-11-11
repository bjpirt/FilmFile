import type {
  ExportDestination,
  ExportFolder,
} from '../../../application/ports/export-destination.ts';
import { FilesystemExportFolder } from '../filesystem/filesystem-export-folder.ts';

/** The channel to the process that started this one: Electron's `process.parentPort`. */
export interface ParentChannel {
  postMessage(message: unknown): void;
  on(event: 'message', listener: (message: { data: unknown }) => void): unknown;
}

/**
 * Asks the desktop app, which started the service, for the folder (D100): it
 * shows its own folder chooser and answers over the private channel between
 * the two, which a page can't reach. The answers are `{ type: 'export-folder',
 * id, folder }`, the folder being null when the person cancels.
 */
export class ParentProcessExportDestination implements ExportDestination {
  readonly #parent: ParentChannel;
  readonly #waiting = new Map<number, (folder: string | undefined) => void>();
  #next = 0;

  constructor(parent: ParentChannel) {
    this.#parent = parent;
    parent.on('message', ({ data }) => {
      if (
        typeof data === 'object' &&
        data !== null &&
        'type' in data &&
        data.type === 'export-folder' &&
        'id' in data &&
        typeof data.id === 'number' &&
        'folder' in data
      ) {
        const answer = this.#waiting.get(data.id);
        this.#waiting.delete(data.id);
        answer?.(typeof data.folder === 'string' ? data.folder : undefined);
      }
    });
  }

  /** The destination of a service started by the desktop app, or none when it has no parent to ask. */
  static ofThisProcess(): ParentProcessExportDestination | undefined {
    const parent: unknown = Reflect.get(process, 'parentPort');
    return isChannel(parent)
      ? new ParentProcessExportDestination(parent)
      : undefined;
  }

  async choose(): Promise<ExportFolder | undefined> {
    this.#next += 1;
    const id = this.#next;
    const folder = await new Promise<string | undefined>((resolve) => {
      this.#waiting.set(id, resolve);
      this.#parent.postMessage({ type: 'choose-export-folder', id });
    });
    return folder === undefined
      ? undefined
      : new FilesystemExportFolder(folder);
  }

  finished(result: {
    readonly folder: string;
    readonly written: number;
    readonly leftOut: number;
  }): void {
    this.#parent.postMessage({ type: 'export-finished', ...result });
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
