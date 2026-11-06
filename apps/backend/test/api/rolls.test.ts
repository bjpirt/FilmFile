import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import { invalidRequestResponse } from '@filmfile/contracts/errors';
import { aJpeg } from '../support/a-jpeg.ts';
import { apiFor, idOf } from '../support/api.ts';
import { folderOfRoll } from '../support/roll-folder.ts';
import { useTempArchive } from '../support/temp-archive.ts';

const archive = useTempArchive();
const { request, post } = apiFor(archive);

function createRoll(roll: string): Promise<Response> {
  return post('/api/rolls', { roll, shot: roll.slice(0, 4) });
}

describe('POST /api/rolls', () => {
  test('creates a roll with an ID and no frames', async () => {
    const response = await createRoll('2026-014');

    const body: unknown = await response.json();

    expect(response.status).toBe(201);
    expect(body).toEqual({
      id: idOf(body),
      roll: '2026-014',
      filed: false,
      name: null,
      notes: null,
      shot: '2026',
      event: null,
      camera: null,
      film: null,
      lens: null,
      frames: [],
    });
    expect(idOf(body)).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
  });

  describe('with no roll number', () => {
    test('gives the next free number of the year shot, and says which', async () => {
      await createRoll('2025-031');

      const response = await post('/api/rolls', { shot: '2025-06' });

      expect(response.status).toBe(201);
      expect(await response.json()).toMatchObject({
        roll: '2025-032',
        shot: '2025-06',
      });
    });

    test('refuses to create a roll without a shot year', async () => {
      const response = await post('/api/rolls', {});

      expect(response.status).toBe(422);
      expect(await response.json()).toMatchObject({
        issues: [{ path: ['shot'] }],
      });
    });

    test('counts a number an unreadable roll’s folder is named for', async () => {
      const broken = path.join(archive.path(), 'rolls/2025/2025-020-ABCD1234');
      await mkdir(broken, { recursive: true });
      await writeFile(path.join(broken, 'roll.json'), '{ not json');

      const response = await post('/api/rolls', { shot: '2025' });

      expect(await response.json()).toMatchObject({ roll: '2025-021' });
    });

    test('gives rolls created at once different numbers', async () => {
      const responses = await Promise.all(
        Array.from({ length: 5 }, () => post('/api/rolls', { shot: '2024' })),
      );

      const numbers = await Promise.all(
        responses.map(async (r) => {
          const body: unknown = await r.json();
          return typeof body === 'object' && body !== null && 'roll' in body
            ? body.roll
            : undefined;
        }),
      );
      expect(responses.map((r) => r.status)).toEqual([201, 201, 201, 201, 201]);
      expect(numbers.sort()).toEqual([
        '2024-001',
        '2024-002',
        '2024-003',
        '2024-004',
        '2024-005',
      ]);
    });

    test('still keeps a number that is sent', async () => {
      const response = await post('/api/rolls', {
        roll: '2026-123',
        shot: '2026',
      });

      expect(await response.json()).toMatchObject({ roll: '2026-123' });
    });
  });

  test('saves the roll as roll.json in a folder named for its number and ID, in its year folder', async () => {
    const response = await createRoll('2026-014');
    const created: unknown = await response.json();

    // Its folder is named by the roll's number and the end of its ID (D66).
    expect(path.basename(await folderOfRoll(archive.path(), '2026-014'))).toBe(
      `2026-014-${String(idOf(created)).slice(-8)}`,
    );
    const saved: unknown = JSON.parse(
      await readFile(
        path.join(await folderOfRoll(archive.path(), '2026-014'), 'roll.json'),
        'utf8',
      ),
    );

    expect(saved).toEqual({
      schema: 2,
      id: idOf(created),
      roll: '2026-014',
      name: null,
      notes: null,
      shot: '2026',
      event: null,
      meta: {},
      frames: [],
    });
  });

  test('creates a roll with its name, notes and date shot', async () => {
    const response = await post('/api/rolls', {
      roll: '2026-014',
      name: '  Iceland, first day ',
      notes: 'Jökulsárlón at dawn.',
      shot: '2026-09-14T06:30',
    });

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      name: 'Iceland, first day',
      notes: 'Jökulsárlón at dawn.',
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
    const body = invalidRequestResponse.parse(await response.json());
    expect(body.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: ['roll'] })]),
    );
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
      await post('/api/rolls', {
        roll: '2026-014',
        name: 'Iceland',
        shot: '2026',
      })
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

  test('changes the roll’s number, keeping its ID, renaming its folder and putting it in its new place in the list', async () => {
    const { url, etag } = await aRollWithDetails();
    const other: unknown = await (
      await post('/api/rolls', { roll: '2026-010', shot: '2026' })
    ).json();

    const response = await patch(url, { roll: '2026-005' }, etag);

    expect(response.status).toBe(200);
    const changed: unknown = await response.json();
    expect(changed).toMatchObject({ roll: '2026-005', name: 'Iceland' });
    expect(idOf(changed)).toBe(url.split('/').at(-1));
    expect(path.basename(await folderOfRoll(archive.path(), '2026-005'))).toBe(
      `2026-005-${String(idOf(changed)).slice(-8)}`,
    );
    expect(await readdir(path.join(archive.path(), 'rolls/2026'))).toHaveLength(
      2,
    );
    const listed: unknown = await (await request('/api/rolls')).json();
    expect(listed).toMatchObject({
      rolls: [{ roll: '2026-005' }, { id: idOf(other), roll: '2026-010' }],
    });
    expect((await request(url)).status).toBe(200);
  });

  test('refuses a number another roll has, as a problem with the number, changing nothing', async () => {
    const { url, etag } = await aRollWithDetails();
    await post('/api/rolls', { roll: '2026-015', shot: '2026' });

    const response = await patch(url, { roll: '2026-015' }, etag);

    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      issues: [{ path: ['roll'], message: 'is already used by another roll' }],
    });
    expect(await (await request(url)).json()).toMatchObject({
      roll: '2026-014',
    });
    expect((await request(url)).headers.get('ETag')).toBe(etag);
  });

  test('refuses something that is not a roll number', async () => {
    const { url, etag } = await aRollWithDetails();

    expect((await patch(url, { roll: '14' }, etag)).status).toBe(422);
  });

  test('takes the roll’s own number as no change', async () => {
    const { url, etag } = await aRollWithDetails();

    const response = await patch(
      url,
      { roll: '2026-014', name: 'Westfjords' },
      etag,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      roll: '2026-014',
      name: 'Westfjords',
    });
  });

  test('changes the details sent, with the new version as its ETag', async () => {
    const { url, etag } = await aRollWithDetails();

    const response = await patch(
      url,
      { notes: 'Jökulsárlón at dawn.', shot: '2026-09' },
      etag,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      name: 'Iceland',
      notes: 'Jökulsárlón at dawn.',
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

  test('marks and unmarks a roll as filed in the API', async () => {
    const { url, etag } = await aRollWithDetails();

    const filed = await patch(url, { filed: true }, etag);

    expect(filed.status).toBe(200);
    expect(await filed.json()).toMatchObject({ filed: true });

    const unfiled = await patch(
      url,
      { filed: false },
      filed.headers.get('ETag') ?? '',
    );

    expect(unfiled.status).toBe(200);
    expect(await unfiled.json()).toMatchObject({ filed: false });
  });

  test('refuses to change a filed roll number with a 422', async () => {
    const { url, etag } = await aRollWithDetails();
    const filed = await patch(url, { filed: true }, etag);
    const filedEtag = filed.headers.get('ETag') ?? '';

    const response = await patch(url, { roll: '2026-015' }, filedEtag);

    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      issues: [
        {
          path: ['roll'],
          message: "A filed roll's number can't be changed.",
        },
      ],
    });
    expect(await (await request(url)).json()).toMatchObject({
      roll: '2026-014',
      filed: true,
    });
    expect((await request(url)).headers.get('ETag')).toBe(filedEtag);
  });

  test('refuses to mark a roll filed with an outdated ETag', async () => {
    const { url, etag } = await aRollWithDetails();
    await patch(url, { name: 'Changed elsewhere' }, etag);

    const response = await patch(url, { filed: true }, etag);

    expect(response.status).toBe(409);
    expect(await (await request(url)).json()).toMatchObject({
      filed: false,
    });
  });
});

describe('DELETE /api/rolls/{id}', () => {
  async function aRollWithAScan() {
    const created: unknown = await (await createRoll('2026-014')).json();
    const url = `/api/rolls/${String(idOf(created))}`;
    const frameId = String(
      idOf(await (await post(`${url}/frames`, {})).json()),
    );
    await request(`${url}/frames/${frameId}/versions?file=12340001.jpg`, {
      method: 'POST',
      headers: { 'Content-Type': 'image/jpeg' },
      body: new Uint8Array(await aJpeg()),
    });
    const etag = (await request(url)).headers.get('ETag') ?? '';
    return { id: String(idOf(created)), url, etag };
  }

  function deleteRoll(url: string, ifMatch?: string) {
    return request(url, {
      method: 'DELETE',
      headers: ifMatch === undefined ? {} : { 'If-Match': ifMatch },
    });
  }

  test('deletes the roll with its frames, moving its whole folder into deleted/', async () => {
    const { id, url, etag } = await aRollWithAScan();

    const response = await deleteRoll(url, etag);

    expect(response.status).toBe(204);
    expect((await request(url)).status).toBe(404);
    const [held] = await readdir(path.join(archive.path(), 'deleted'));
    const folder = path.join(archive.path(), 'deleted', held ?? '');
    expect(held).toMatch(
      new RegExp(`^\\d{4}-\\d{2}-\\d{2}T\\d{6}Z-roll-${id}$`),
    );
    expect(
      JSON.parse(
        await readFile(path.join(folder, 'roll-deleted.json'), 'utf8'),
      ),
    ).toMatchObject({ schema: 1, roll: { id, roll: '2026-014' } });
    expect(
      JSON.parse(
        await readFile(
          path.join(folder, `2026-014-${id.slice(-8)}`, 'roll.json'),
          'utf8',
        ),
      ),
    ).toMatchObject({ id, frames: [{ versions: [{}] }] });
    // The year's folder goes with its last roll.
    expect(await readdir(path.join(archive.path(), 'rolls'))).toEqual([]);
  });

  test('requires If-Match', async () => {
    const { url } = await aRollWithAScan();

    expect((await deleteRoll(url)).status).toBe(428);
  });

  test('refuses a stale If-Match, keeping the roll', async () => {
    const { url, etag } = await aRollWithAScan();
    await post(`${url}/frames`, {});

    expect((await deleteRoll(url, etag)).status).toBe(409);
    expect((await request(url)).status).toBe(200);
  });

  test('returns 404 for an ID that no roll has', async () => {
    expect(
      (await deleteRoll('/api/rolls/01JC8Z7K3M0000000000000000', '"1"')).status,
    ).toBe(404);
  });
});
