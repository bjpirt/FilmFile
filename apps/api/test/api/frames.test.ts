import { describe, expect, test } from 'vitest';
import { apiFor, idOf } from '../support/api.ts';
import { useTempArchive } from '../support/temp-archive.ts';

const archive = useTempArchive();
const { request, post } = apiFor(archive);

async function aRoll(): Promise<string> {
  const created: unknown = await (
    await post('/api/rolls', { roll: '2026-014' })
  ).json();
  return String(idOf(created));
}

describe('POST /api/rolls/{id}/frames', () => {
  test('creates a frame with an ID, no frame number and no versions', async () => {
    const rollId = await aRoll();

    const response = await post(`/api/rolls/${rollId}/frames`, {});
    const frame: unknown = await response.json();

    expect(response.status).toBe(201);
    expect(frame).toEqual({ id: idOf(frame), number: null, versions: [] });
    expect(idOf(frame)).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
  });

  test('records the frame number when one is given', async () => {
    const rollId = await aRoll();

    const response = await post(`/api/rolls/${rollId}/frames`, {
      number: '12A',
    });

    expect(await response.json()).toMatchObject({ number: '12A' });
  });

  test('adds frames to the roll in the order they were created', async () => {
    const rollId = await aRoll();
    const first: unknown = await (
      await post(`/api/rolls/${rollId}/frames`, { number: '1' })
    ).json();
    const second: unknown = await (
      await post(`/api/rolls/${rollId}/frames`, { number: '2' })
    ).json();

    const roll: unknown = await (await request(`/api/rolls/${rollId}`)).json();

    expect(roll).toMatchObject({ frames: [first, second] });
  });

  test('returns 404 for a roll that does not exist', async () => {
    const response = await post(
      '/api/rolls/01JC8Z7K3M0000000000000000/frames',
      {},
    );

    expect(response.status).toBe(404);
  });

  test.each([{ number: 23 }, { number: '' }])(
    'rejects %j, which is not a frame number',
    async (body) => {
      const rollId = await aRoll();

      const response = await post(`/api/rolls/${rollId}/frames`, body);

      expect(response.status).toBe(422);
    },
  );
});
