import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { composeLocal } from '../../src/composition/compose-local.ts';
import { origin, port } from '../support/api.ts';

let uiPath = '';

beforeAll(async () => {
  uiPath = await mkdtemp(path.join(tmpdir(), 'filmfile-ui-'));
  await mkdir(uiPath, { recursive: true });
  await writeFile(path.join(uiPath, 'index.html'), '<p>FilmFile</p>');
});

afterAll(async () => {
  await rm(uiPath, { recursive: true, force: true });
});

function request(url: string, init?: RequestInit): Promise<Response> {
  const app = composeLocal({
    archivePath: '/unused',
    cachePath: '/unused',
    uiPath,
    port,
  });
  return Promise.resolve(app.request(`${origin}${url}`, init));
}

describe('every response', () => {
  test.each([
    ['the API', '/api/health', undefined],
    ['the UI', '/', undefined],
    [
      'a page the UI routes itself',
      '/rolls/01JC8Z7K3M0000000000000000',
      undefined,
    ],
    ['an unknown API path', '/api/nothing-here', undefined],
    [
      'a refused request',
      '/api/health',
      { headers: { Origin: 'https://attacker.example' } },
    ],
  ])('from %s carries the security headers', async (_case, url, init) => {
    const response = await request(url, init);

    expect(response.headers.get('Content-Security-Policy')).toBe(
      "default-src 'self'; frame-ancestors 'none'",
    );
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(response.headers.get('Referrer-Policy')).toBe('no-referrer');
  });
});

test('the API docs page may also use inline styles and data: images, which Swagger UI needs, but no other scripts', async () => {
  const response = await request('/api/docs');

  expect(response.headers.get('Content-Security-Policy')).toBe(
    "default-src 'self'; frame-ancestors 'none'; style-src 'self' 'unsafe-inline'; img-src 'self' data:",
  );
});
