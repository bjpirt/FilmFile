import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { composeLocal } from '../../src/composition/compose-local.ts';

// The UI folder sits inside a temp folder, so a test can put a file beside it.
let folder = '';
let uiPath = '';

beforeEach(async () => {
  folder = await mkdtemp(path.join(tmpdir(), 'filmfile-ui-'));
  uiPath = path.join(folder, 'dist');
  await mkdir(path.join(uiPath, 'assets'), { recursive: true });
  await writeFile(path.join(uiPath, 'index.html'), '<p>FilmFile</p>');
  await writeFile(path.join(uiPath, 'assets', 'app.js'), 'run();');
});

afterEach(async () => {
  await rm(folder, { recursive: true, force: true });
});

function request(url: string, ui = uiPath): Promise<Response> {
  const app = composeLocal({
    archivePath: '/unused',
    cachePath: '/unused',
    uiPath: ui,
  });
  return Promise.resolve(app.request(url));
}

describe('the built UI', () => {
  test('is served at the root', async () => {
    const response = await request('/');

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toMatch(/^text\/html/);
    expect(await response.text()).toBe('<p>FilmFile</p>');
  });

  test('is checked for changes on every visit, so a new build is picked up', async () => {
    for (const url of ['/', '/rolls/01JC8Z7K3M0000000000000000']) {
      const response = await request(url);

      expect(response.headers.get('Cache-Control')).toBe('no-cache');
    }
  });

  test('has its assets cached for good, since a new build gives them new names', async () => {
    const response = await request('/assets/app.js');

    expect(response.headers.get('Cache-Control')).toBe(
      'public, max-age=31536000, immutable',
    );
  });

  test('has its assets served with their content types', async () => {
    const response = await request('/assets/app.js');

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toMatch(/^text\/javascript/);
    expect(await response.text()).toBe('run();');
  });

  test('is served for paths the UI routes itself', async () => {
    const response = await request('/rolls/01JC8Z7K3M0000000000000000');

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('<p>FilmFile</p>');
  });

  test('is not served for an unknown API path', async () => {
    const response = await request('/api/nothing-here');

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'not found' });
  });

  test.each([
    '/../secret.txt',
    '/%2e%2e/secret.txt',
    '/assets/%2e%2e%2f..%2fsecret.txt',
  ])('never serves a file outside the UI folder for %s', async (url) => {
    await writeFile(path.join(folder, 'secret.txt'), 'secret');

    const response = await request(url);

    expect(await response.text()).not.toContain('secret');
  });

  test('says how to build it when it has not been built', async () => {
    const response = await request('/', path.join(uiPath, 'missing'));

    expect(response.status).toBe(404);
    expect(await response.text()).toMatch(/pnpm build/);
  });
});
