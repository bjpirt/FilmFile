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

describe('PATCH /api/rolls/{id}/frames/{frameId}', () => {
  async function aRollWithAFrame() {
    const rollId = await aRoll();
    const frameId = String(
      idOf(await (await post(`/api/rolls/${rollId}/frames`, {})).json()),
    );
    const etag = (await request(`/api/rolls/${rollId}`)).headers.get('ETag');
    return {
      rollId,
      frameId,
      url: `/api/rolls/${rollId}/frames/${frameId}`,
      etag: etag ?? '',
    };
  }

  function patch(
    url: string,
    body: unknown,
    ifMatch?: string,
  ): Promise<Response> {
    return request(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(ifMatch === undefined ? {} : { 'If-Match': ifMatch }),
      },
      body: JSON.stringify(body),
    });
  }

  test('sets the frame number, and returns the frame and the roll’s new ETag', async () => {
    const { rollId, frameId, url, etag } = await aRollWithAFrame();

    const response = await patch(url, { number: '12A' }, etag);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      id: frameId,
      number: '12A',
      versions: [],
    });
    const newEtag = response.headers.get('ETag');
    expect(newEtag).not.toBe(etag);
    const roll = await request(`/api/rolls/${rollId}`);
    expect(roll.headers.get('ETag')).toBe(newEtag);
  });

  test('clears the frame number with null', async () => {
    const { url, etag } = await aRollWithAFrame();

    const response = await patch(url, { number: null }, etag);

    expect(await response.json()).toMatchObject({ number: null });
  });

  test('requires If-Match', async () => {
    const { url } = await aRollWithAFrame();

    const response = await patch(url, { number: '1' });

    expect(response.status).toBe(428);
    expect(await response.json()).toEqual({
      error: 'send the roll’s ETag as If-Match',
    });
  });

  test('refuses a stale If-Match, keeping the other change', async () => {
    const { rollId, url, etag } = await aRollWithAFrame();
    await post(`/api/rolls/${rollId}/frames`, {});

    const response = await patch(url, { number: '1' }, etag);

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: 'the roll has changed since it was read',
    });
  });

  test.each([
    ['over 9 characters', { number: '1234567890' }],
    ['empty', { number: '' }],
    ['not text', { number: 12 }],
  ])('refuses a number that is %s', async (_case, body) => {
    const { url, etag } = await aRollWithAFrame();

    expect((await patch(url, body, etag)).status).toBe(422);
  });

  test('says when the frame does not exist', async () => {
    const { rollId, etag } = await aRollWithAFrame();

    const response = await patch(
      `/api/rolls/${rollId}/frames/01JC8Z7K3M0000000000000000`,
      { number: '1' },
      etag,
    );

    expect(response.status).toBe(404);
  });
});
