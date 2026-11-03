import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import { apiFor, idOf } from '../support/api.ts';
import { useTempArchive } from '../support/temp-archive.ts';

const archive = useTempArchive();
const { request, post } = apiFor(archive);

function createRoll(roll: string): Promise<Response> {
  return post('/api/rolls', { roll });
}

describe('POST /api/rolls', () => {
  test('creates a roll with an ID and no frames', async () => {
    const response = await createRoll('2026-014');

    const body: unknown = await response.json();

    expect(response.status).toBe(201);
    expect(body).toEqual({
      id: idOf(body),
      roll: '2026-014',
      name: null,
      description: null,
      shot: null,
      frames: [],
    });
    expect(idOf(body)).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
  });

  test('saves the roll as roll.json in its year folder', async () => {
    const response = await createRoll('2026-014');
    const created: unknown = await response.json();

    const saved: unknown = JSON.parse(
      await readFile(
        path.join(archive.path(), 'rolls/2026/2026-014/roll.json'),
        'utf8',
      ),
    );

    expect(saved).toEqual({
      schema: 1,
      id: idOf(created),
      roll: '2026-014',
      name: null,
      description: null,
      shot: null,
      frames: [],
    });
  });

  test('creates a roll with its name, description and date shot', async () => {
    const response = await post('/api/rolls', {
      roll: '2026-014',
      name: '  Iceland, first day ',
      description: 'Jökulsárlón at dawn.',
      shot: '2026-09-14T06:30',
    });

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      name: 'Iceland, first day',
      description: 'Jökulsárlón at dawn.',
      shot: '2026-09-14T06:30',
    });
  });

  test.each(['2026-02-30', '2026-13', '26'])(
    'refuses a date shot of %j',
    async (shot) => {
      const response = await post('/api/rolls', { roll: '2026-014', shot });

      expect(response.status).toBe(422);
      expect(await response.json()).toMatchObject({
        issues: [{ path: ['shot'] }],
      });
    },
  );

  test('refuses a roll number that already exists', async () => {
    await createRoll('2026-014');

    const response = await createRoll('2026-014');

    expect(response.status).toBe(409);
  });

  test('says which field is wrong when the request is invalid', async () => {
    const response = await post('/api/rolls', { roll: 2026 });

    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      issues: [{ path: ['roll'] }],
    });
  });

  test('rejects a body that is not valid JSON', async () => {
    const response = await request('/api/rolls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"roll": ',
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'Malformed JSON in request body',
    });
  });

  test.each(['2026-14', '26-014', '2026-014a', '../../2026-014', ''])(
    'rejects %j, which is not a YYYY-NNN roll number',
    async (roll) => {
      const response = await createRoll(roll);

      expect(response.status).toBe(422);
    },
  );
});

describe('GET /api/rolls', () => {
  test('lists nothing in an empty archive', async () => {
    const response = await request('/api/rolls');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ rolls: [], unreadable: [] });
  });

  test('lists every roll, ordered by roll number', async () => {
    const roll014: unknown = await (await createRoll('2026-014')).json();
    const roll003: unknown = await (await createRoll('2025-003')).json();
    const roll002: unknown = await (await createRoll('2026-002')).json();

    const response = await request('/api/rolls');

    expect(await response.json()).toEqual({
      rolls: [roll003, roll002, roll014],
      unreadable: [],
    });
  });

  test('lists a roll whose roll.json cannot be read separately, with the problem', async () => {
    const created: unknown = await (await createRoll('2026-014')).json();
    const broken = path.join(archive.path(), 'rolls/2026/2026-015');
    await mkdir(broken, { recursive: true });
    await writeFile(path.join(broken, 'roll.json'), '{ not json');

    const response = await request('/api/rolls');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      rolls: [created],
      unreadable: [{ folder: '2026-015', problem: 'it is not valid JSON' }],
    });
  });
});

describe('GET /api/rolls/{id}', () => {
  test('returns the roll with that ID', async () => {
    const created: unknown = await (await createRoll('2026-014')).json();

    const response = await request(`/api/rolls/${String(idOf(created))}`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(created);
  });

  test('rejects an ID that is not a ULID', async () => {
    const response = await request('/api/rolls/2026-014');

    expect(response.status).toBe(422);
  });

  test('returns 404 for an ID that no roll has', async () => {
    await createRoll('2026-014');

    const response = await request('/api/rolls/01JC8Z7K3M0000000000000000');

    expect(response.status).toBe(404);
  });
});

describe('PATCH /api/rolls/{id}', () => {
  async function aRollWithDetails() {
    const created: unknown = await (
      await post('/api/rolls', { roll: '2026-014', name: 'Iceland' })
    ).json();
    const url = `/api/rolls/${String(idOf(created))}`;
    const etag = (await request(url)).headers.get('ETag') ?? '';
    return { url, etag };
  }

  function patch(url: string, body: unknown, ifMatch?: string) {
    return request(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(ifMatch === undefined ? {} : { 'If-Match': ifMatch }),
      },
      body: JSON.stringify(body),
    });
  }

  test('changes the details sent, with the new version as its ETag', async () => {
    const { url, etag } = await aRollWithDetails();

    const response = await patch(
      url,
      { description: 'Jökulsárlón at dawn.', shot: '2026-09' },
      etag,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      name: 'Iceland',
      description: 'Jökulsárlón at dawn.',
      shot: '2026-09',
    });
    expect(response.headers.get('ETag')).toBe(
      (await request(url)).headers.get('ETag'),
    );
  });

  test('clears a detail sent as null', async () => {
    const { url, etag } = await aRollWithDetails();

    const response = await patch(url, { name: null }, etag);

    expect(await response.json()).toMatchObject({ name: null });
  });

  test('requires If-Match', async () => {
    const { url } = await aRollWithDetails();

    const response = await patch(url, { name: 'Westfjords' });

    expect(response.status).toBe(428);
  });

  test('refuses a stale If-Match, keeping the other change', async () => {
    const { url, etag } = await aRollWithDetails();
    await patch(url, { name: 'Westfjords' }, etag);

    const response = await patch(url, { name: 'Reykjavík' }, etag);

    expect(response.status).toBe(409);
    expect(await (await request(url)).json()).toMatchObject({
      name: 'Westfjords',
    });
  });

  test.each([
    ['a date shot that is not a date', { shot: '14 September' }],
    ['a date shot that does not exist', { shot: '2026-02-30' }],
    ['a name that is too long', { name: 'x'.repeat(101) }],
  ])('refuses %s', async (_, body) => {
    const { url, etag } = await aRollWithDetails();

    expect((await patch(url, body, etag)).status).toBe(422);
  });

  test('returns 404 for an ID that no roll has', async () => {
    const response = await patch(
      '/api/rolls/01JC8Z7K3M0000000000000000',
      { name: 'x' },
      '"1"',
    );

    expect(response.status).toBe(404);
  });
});
