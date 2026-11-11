import type { Clock } from '../../src/application/ports/clock.ts';
import type { ExportDestination } from '../../src/application/ports/export-destination.ts';
import type { IdGenerator } from '../../src/application/ports/id-generator.ts';
import { composeLocal } from '../../src/composition/compose-local.ts';
import type { TempArchive } from './temp-archive.ts';

export const port = 4310;

/** The backend's own address, which its request checks accept as Host and Origin. */
export const origin = `http://127.0.0.1:${String(port)}`;

/**
 * Sends requests to a service wired to the given archive, without a network,
 * the way the UI does: to the backend's address, with its Origin.
 */
export function apiFor(
  archive: TempArchive,
  overrides: {
    readonly clock?: Clock;
    readonly ids?: IdGenerator;
    readonly destination?: ExportDestination;
  } = {},
) {
  // One app per test archive, as the real service has one app: requests to
  // it share its repositories, and so the locks that make them take turns.
  let app: ReturnType<typeof composeLocal> | undefined;
  let appArchive = '';

  function appForArchive() {
    if (app === undefined || appArchive !== archive.path()) {
      appArchive = archive.path();
      app = composeLocal({
        folderPath: archive.folder(),
        archivePath: archive.path(),
        cachePath: archive.cachePath(),
        port,
        ...overrides,
      });
    }
    return app;
  }

  function request(url: string, init?: RequestInit): Promise<Response> {
    const app = appForArchive();
    const headers = new Headers(init?.headers);
    headers.set('Origin', origin);
    return Promise.resolve(
      app.request(new URL(url, origin), { ...init, headers }),
    );
  }

  function post(url: string, body: unknown): Promise<Response> {
    return request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  return { request, post };
}

/** The `id` field of a JSON response body, if it has one. */
export function idOf(body: unknown): unknown {
  return typeof body === 'object' && body !== null && 'id' in body
    ? body.id
    : undefined;
}
