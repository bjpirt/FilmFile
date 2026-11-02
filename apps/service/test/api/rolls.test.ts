import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import { composeLocal } from '../../src/composition/compose-local.ts';
import { useTempArchive } from '../support/temp-archive.ts';

const archive = useTempArchive();

function createRoll(roll: string): Promise<Response> {
  const app = composeLocal({ archivePath: archive.path() });
  return Promise.resolve(
    app.request('/api/rolls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roll }),
    }),
  );
}

function idOf(body: unknown): unknown {
  return typeof body === 'object' && body !== null && 'id' in body
    ? body.id
    : undefined;
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

  test.each(['2026-14', '26-014', '2026-014a', '../../2026-014', ''])(
    'rejects %j, which is not a YYYY-NNN roll ID',
    async (roll) => {
      const response = await createRoll(roll);

      expect(response.status).toBe(422);
    },
  );
});
