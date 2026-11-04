import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import { apiFor, idOf } from '../support/api.ts';
import { useTempArchive } from '../support/temp-archive.ts';

const archive = useTempArchive();
const { request, post } = apiFor(archive);

function patch(body: unknown, ifMatch?: string): Promise<Response> {
  return request('/api/archive', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...(ifMatch === undefined ? {} : { 'If-Match': ifMatch }),
    },
    body: JSON.stringify(body),
  });
}

describe('GET /api/archive', () => {
  test('says the archive isn’t set up until it is', async () => {
    expect((await request('/api/archive')).status).toBe(404);
  });

  test('gives the archive’s details, with its version as the ETag', async () => {
    await post('/api/archive', { author: 'Ben Pirt' });

    const response = await request('/api/archive');

    expect(response.status).toBe(200);
    expect(response.headers.get('ETag')).toMatch(/^".+"$/);
    expect(await response.json()).toMatchObject({
      author: 'Ben Pirt',
      copyright: null,
    });
  });
});

describe('POST /api/archive', () => {
  test('sets the archive up, saving archive.json at its root', async () => {
    const response = await post('/api/archive', {
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
        await readFile(path.join(archive.path(), 'archive.json'), 'utf8'),
      ),
    ).toEqual({
      schema: 1,
      id: idOf(created),
      meta: { author: 'Ben Pirt', copyright: '© Ben Pirt' },
    });
  });

  test('refuses to set it up twice', async () => {
    await post('/api/archive', { author: 'First' });

    expect((await post('/api/archive', { author: 'Second' })).status).toBe(409);
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
    expect((await post('/api/archive', body)).status).toBe(422);
  });
});

describe('PATCH /api/archive', () => {
  async function setUp(): Promise<string> {
    await post('/api/archive', { author: 'Ben', copyright: '© Ben' });
    return (await request('/api/archive')).headers.get('ETag') ?? '';
  }

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
    expect((await request('/api/archive')).headers.get('ETag')).toBe(newEtag);
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

  test('says when the archive isn’t set up', async () => {
    expect((await patch({ author: 'B' }, '"x"')).status).toBe(404);
  });
});
