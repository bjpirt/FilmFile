import { composeLocal } from '../../src/composition/compose-local.ts';
import type { TempArchive } from './temp-archive.ts';

/** Sends requests to a service wired to the given archive, without a network. */
export function apiFor(archive: TempArchive) {
  function request(url: string, init?: RequestInit): Promise<Response> {
    const app = composeLocal({
      archivePath: archive.path(),
      cachePath: archive.cachePath(),
    });
    return Promise.resolve(app.request(url, init));
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
