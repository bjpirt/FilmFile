import { readFile } from 'node:fs/promises';
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
    expect(body).toEqual({ id: idOf(body), roll: '2026-014', frames: [] });
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
      frames: [],
    });
  });

  test('refuses a roll ID that already exists', async () => {
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

    expect(response.status).toBe(422);
  });

  test.each(['2026-14', '26-014', '2026-014a', '../../2026-014', ''])(
    'rejects %j, which is not a YYYY-NNN roll ID',
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
    expect(await response.json()).toEqual([]);
  });

  test('lists every roll, ordered by roll ID', async () => {
    const roll014: unknown = await (await createRoll('2026-014')).json();
    const roll003: unknown = await (await createRoll('2025-003')).json();
    const roll002: unknown = await (await createRoll('2026-002')).json();

    const response = await request('/api/rolls');

    expect(await response.json()).toEqual([roll003, roll002, roll014]);
  });
});

describe('GET /api/rolls/{id}', () => {
  test('returns the roll with that ID', async () => {
    const created: unknown = await (await createRoll('2026-014')).json();

    const response = await request(`/api/rolls/${String(idOf(created))}`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(created);
  });

  test('returns 404 for an ID that no roll has', async () => {
    await createRoll('2026-014');

    const response = await request('/api/rolls/01JC8Z7K3M0000000000000000');

    expect(response.status).toBe(404);
  });
});
