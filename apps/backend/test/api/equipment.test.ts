import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import { apiFor, idOf } from '../support/api.ts';
import { useTempArchive } from '../support/temp-archive.ts';

const archive = useTempArchive();
const { request, post } = apiFor(archive);

describe('POST /api/equipment/cameras', () => {
  test('adds a camera, saved as its own file named by its slug', async () => {
    const response = await post('/api/equipment/cameras', { name: 'Nikon FE' });

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      slug: 'nikon-fe',
      name: 'Nikon FE',
    });
    expect(
      JSON.parse(
        await readFile(
          path.join(archive.path(), 'equipment/cameras/nikon-fe.json'),
          'utf8',
        ),
      ),
    ).toEqual({ schema: 1, name: 'Nikon FE' });
  });

  test('refuses a camera whose slug another camera has', async () => {
    await post('/api/equipment/cameras', { name: 'Nikon FE' });

    const response = await post('/api/equipment/cameras', { name: 'NIKON FE' });

    expect(response.status).toBe(409);
  });

  test.each([
    ['no name', {}],
    ['a name with no letters or digits', { name: '--' }],
    ['a name that is too long', { name: 'x'.repeat(101) }],
  ])('refuses %s', async (_, body) => {
    expect((await post('/api/equipment/cameras', body)).status).toBe(422);
  });
});

describe('GET /api/equipment/cameras', () => {
  test('lists the cameras by name', async () => {
    await post('/api/equipment/cameras', { name: 'Pentax K1000' });
    await post('/api/equipment/cameras', { name: 'Nikon FE' });

    const response = await request('/api/equipment/cameras');

    expect(await response.json()).toEqual({
      cameras: [
        { slug: 'nikon-fe', name: 'Nikon FE' },
        { slug: 'pentax-k1000', name: 'Pentax K1000' },
      ],
    });
  });
});

describe('a roll’s camera', () => {
  test('is recorded when the roll is created, and changed with its details', async () => {
    await post('/api/equipment/cameras', { name: 'Nikon FE' });
    await post('/api/equipment/cameras', { name: 'Pentax K1000' });
    const created: unknown = await (
      await post('/api/rolls', { roll: '2026-014', camera: 'nikon-fe' })
    ).json();
    const url = `/api/rolls/${String(idOf(created))}`;
    const etag = (await request(url)).headers.get('ETag') ?? '';

    const changed = await request(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'If-Match': etag },
      body: JSON.stringify({ camera: 'pentax-k1000' }),
    });

    expect(created).toMatchObject({ camera: 'nikon-fe' });
    expect(await changed.json()).toMatchObject({ camera: 'pentax-k1000' });
  });

  test('must be a camera in the archive', async () => {
    const response = await post('/api/rolls', {
      roll: '2026-014',
      camera: 'nikon-fe',
    });

    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      issues: [{ path: ['camera'] }],
    });
  });
});
