import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import { apiFor, idOf } from '../support/api.ts';
import { useTempArchive } from '../support/temp-archive.ts';

const archive = useTempArchive();
const { request, post } = apiFor(archive);

// What a response says of the FilmFile folder, which can't be set by a request.
function folderOf(body: unknown): unknown {
  return typeof body === 'object' && body !== null && 'folder' in body
    ? body.folder
    : undefined;
}

function patch(body: unknown, ifMatch?: string): Promise<Response> {
  return request('/api/settings', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...(ifMatch === undefined ? {} : { 'If-Match': ifMatch }),
    },
    body: JSON.stringify(body),
  });
}

describe('GET /api/settings', () => {
  test('says it isn’t set up until it is', async () => {
    expect((await request('/api/settings')).status).toBe(404);
  });

  test('gives the settings, with their version as the ETag', async () => {
    await post('/api/settings', { author: 'Ben Pirt' });

    const response = await request('/api/settings');

    expect(response.status).toBe(200);
    expect(response.headers.get('ETag')).toMatch(/^".+"$/);
    expect(await response.json()).toMatchObject({
      author: 'Ben Pirt',
      copyright: null,
    });
  });

  test('says where the FilmFile folder is, read-only (D64)', async () => {
    await post('/api/settings', { author: 'Ben Pirt' });

    const body: unknown = await (await request('/api/settings')).json();

    expect(folderOf(body)).toBe(archive.folder());
  });
});

describe('POST /api/settings', () => {
  test('sets FilmFile up, saving settings.json at the FilmFile folder’s top level, not in the Library', async () => {
    const response = await post('/api/settings', {
      author: 'Ben Pirt',
      copyright: '© Ben Pirt',
    });

    expect(response.status).toBe(201);
    const created: unknown = await response.json();
    expect(created).toMatchObject({
      author: 'Ben Pirt',
      copyright: '© Ben Pirt',
    });
    expect(
      JSON.parse(
        await readFile(path.join(archive.folder(), 'settings.json'), 'utf8'),
      ),
    ).toEqual({
      schema: 1,
      id: idOf(created),
      meta: { author: 'Ben Pirt', copyright: '© Ben Pirt' },
    });
    // No folder path in the file: it comes from the service's own settings.
    expect(
      await readFile(path.join(archive.folder(), 'settings.json'), 'utf8'),
    ).not.toContain(archive.folder());
    expect(await readdir(archive.path())).toEqual([]);
  });

  test('says where the FilmFile folder is in its answer, and takes no folder from the request', async () => {
    const response = await post('/api/settings', {
      author: 'Ben Pirt',
      folder: '/somewhere/else',
    });

    expect(response.status).toBe(201);
    expect(folderOf(await response.json())).toBe(archive.folder());
    expect(
      await readFile(path.join(archive.folder(), 'settings.json'), 'utf8'),
    ).not.toContain('somewhere');
  });

  test('refuses to set it up twice', async () => {
    await post('/api/settings', { author: 'First' });

    expect((await post('/api/settings', { author: 'Second' })).status).toBe(
      409,
    );
  });

  test.each([
    ['no author', {}],
    ['a blank author', { author: ' ' }],
    ['an author that is too long', { author: 'x'.repeat(101) }],
    [
      'a copyright that is too long',
      { author: 'Ben', copyright: 'x'.repeat(201) },
    ],
  ])('refuses %s', async (_, body) => {
    expect((await post('/api/settings', body)).status).toBe(422);
  });
});

describe('PATCH /api/settings', () => {
  async function setUp(): Promise<string> {
    await post('/api/settings', { author: 'Ben', copyright: '© Ben' });
    return (await request('/api/settings')).headers.get('ETag') ?? '';
  }

  test('takes no folder from the request', async () => {
    const etag = await setUp();

    const response = await patch({ author: 'Ben', folder: '/elsewhere' }, etag);

    expect(response.status).toBe(200);
    expect(folderOf(await response.json())).toBe(archive.folder());
    expect(
      await readFile(path.join(archive.folder(), 'settings.json'), 'utf8'),
    ).not.toContain('elsewhere');
  });

  test('changes the details given, returning the new ETag', async () => {
    const etag = await setUp();

    const response = await patch({ author: 'Ben Pirt', copyright: null }, etag);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      author: 'Ben Pirt',
      copyright: null,
    });
    const newEtag = response.headers.get('ETag');
    expect(newEtag).not.toBe(etag);
    expect((await request('/api/settings')).headers.get('ETag')).toBe(newEtag);
  });

  test.each([
    ['no If-Match', { author: 'B' }, undefined, 428],
    ['a stale If-Match', { author: 'B' }, '"stale"', 409],
    ['clearing the author', { author: null }, 'etag', 422],
  ])('refuses %s', async (_, body, ifMatch, status) => {
    const etag = await setUp();

    expect(
      (await patch(body, ifMatch === 'etag' ? etag : ifMatch)).status,
    ).toBe(status);
  });

  test('says when FilmFile isn’t set up', async () => {
    expect((await patch({ author: 'B' }, '"x"')).status).toBe(404);
  });
});
