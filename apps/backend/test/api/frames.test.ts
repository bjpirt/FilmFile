import { glob, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import { aJpeg } from '../support/a-jpeg.ts';
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
    expect(frame).toEqual({
      id: idOf(frame),
      number: null,
      defaultVersion: null,
      versions: [],
    });
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
      defaultVersion: null,
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

describe('PATCH a frame’s version shown', () => {
  test('shows the version chosen, then the newest again with null', async () => {
    const rollId = await aRoll();
    const frameId = String(
      idOf(await (await post(`/api/rolls/${rollId}/frames`, {})).json()),
    );
    const uploaded: unknown = await (
      await request(
        `/api/rolls/${rollId}/frames/${frameId}/versions?file=12340001.jpg`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'image/jpeg' },
          body: new Uint8Array(await aJpeg()),
        },
      )
    ).json();
    const url = `/api/rolls/${rollId}/frames/${frameId}`;
    const etag = (await request(`/api/rolls/${rollId}`)).headers.get('ETag');

    const chosen = await request(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'If-Match': etag ?? '',
      },
      body: JSON.stringify({ defaultVersion: idOf(uploaded) }),
    });
    const cleared = await request(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'If-Match': chosen.headers.get('ETag') ?? '',
      },
      body: JSON.stringify({ defaultVersion: null }),
    });

    expect(await chosen.json()).toMatchObject({
      defaultVersion: idOf(uploaded),
    });
    expect(await cleared.json()).toMatchObject({ defaultVersion: null });
  });
});

describe('PATCH /api/rolls/{id}/frames', () => {
  async function aRollWithFrames(count: number) {
    const rollId = await aRoll();
    const frameIds: string[] = [];
    for (let i = 0; i < count; i += 1) {
      frameIds.push(
        String(
          idOf(await (await post(`/api/rolls/${rollId}/frames`, {})).json()),
        ),
      );
    }
    const etag = (await request(`/api/rolls/${rollId}`)).headers.get('ETag');
    return {
      rollId,
      frameIds,
      url: `/api/rolls/${rollId}/frames`,
      etag: etag ?? '',
    };
  }

  function patchNumbers(url: string, body: unknown, ifMatch?: string) {
    return request(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(ifMatch === undefined ? {} : { 'If-Match': ifMatch }),
      },
      body: JSON.stringify(body),
    });
  }

  test('sets many frames’ numbers in one save, returning the roll and its new ETag', async () => {
    const { rollId, frameIds, url, etag } = await aRollWithFrames(3);

    const response = await patchNumbers(
      url,
      {
        numbers: frameIds.map((frameId, i) => ({
          frameId,
          number: String(3 - i),
        })),
      },
      etag,
    );

    expect(response.status).toBe(200);
    const roll: unknown = await response.json();
    expect(roll).toMatchObject({
      id: rollId,
      frames: [{ number: '3' }, { number: '2' }, { number: '1' }],
    });
    const fetched = await request(`/api/rolls/${rollId}`);
    expect(await fetched.json()).toEqual(roll);
    expect(response.headers.get('ETag')).toBe(fetched.headers.get('ETag'));
  });

  test('requires If-Match', async () => {
    const { frameIds, url } = await aRollWithFrames(1);

    const response = await patchNumbers(url, {
      numbers: frameIds.map((frameId) => ({ frameId, number: '1' })),
    });

    expect(response.status).toBe(428);
  });

  test('refuses a stale If-Match, changing nothing', async () => {
    const { rollId, frameIds, url, etag } = await aRollWithFrames(1);
    await post(`/api/rolls/${rollId}/frames`, {});

    const response = await patchNumbers(
      url,
      { numbers: frameIds.map((frameId) => ({ frameId, number: '9' })) },
      etag,
    );

    expect(response.status).toBe(409);
    expect(await (await request(`/api/rolls/${rollId}`)).json()).toMatchObject({
      frames: [{ number: null }, { number: null }],
    });
  });

  test('says which number is invalid', async () => {
    const { frameIds, url, etag } = await aRollWithFrames(2);

    const response = await patchNumbers(
      url,
      {
        numbers: frameIds.map((frameId, i) => ({
          frameId,
          number: i === 1 ? '1234567890' : '1',
        })),
      },
      etag,
    );

    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      issues: [{ path: ['numbers', 1, 'number'] }],
    });
  });

  test('says when a frame is not in the roll', async () => {
    const { url, etag } = await aRollWithFrames(1);

    const response = await patchNumbers(
      url,
      { numbers: [{ frameId: '01JC8Z7K3M0000000000000000', number: '1' }] },
      etag,
    );

    expect(response.status).toBe(404);
  });
});

describe('DELETE /api/rolls/{id}/frames/{frameId}', () => {
  /** A roll with one scanned frame: its URL, the roll's ETag, and the scan's bytes. */
  async function aScannedFrame() {
    const rollId = await aRoll();
    const frameId = String(
      idOf(
        await (
          await post(`/api/rolls/${rollId}/frames`, { number: '12' })
        ).json(),
      ),
    );
    const scan = new Uint8Array(await aJpeg());
    await request(
      `/api/rolls/${rollId}/frames/${frameId}/versions?file=12340012.jpg`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'image/jpeg' },
        body: scan,
      },
    );
    const etag = (await request(`/api/rolls/${rollId}`)).headers.get('ETag');
    return {
      rollId,
      frameId,
      url: `/api/rolls/${rollId}/frames/${frameId}`,
      etag: etag ?? '',
      scan,
    };
  }

  function deleteFrame(url: string, ifMatch?: string) {
    return request(url, {
      method: 'DELETE',
      headers: ifMatch === undefined ? {} : { 'If-Match': ifMatch },
    });
  }

  test('takes the frame out of the roll, with the roll’s new version as its ETag', async () => {
    const { rollId, url, etag } = await aScannedFrame();

    const response = await deleteFrame(url, etag);

    const roll = await request(`/api/rolls/${rollId}`);
    expect(response.status).toBe(204);
    expect(response.headers.get('ETag')).toBe(roll.headers.get('ETag'));
    expect(await roll.json()).toMatchObject({ frames: [] });
  });

  test('moves the frame’s folder and its JSON into deleted/, the scan unchanged', async () => {
    const { frameId, url, etag, scan } = await aScannedFrame();

    await deleteFrame(url, etag);

    const [held] = await readdir(path.join(archive.path(), 'deleted'));
    const folder = path.join(archive.path(), 'deleted', held ?? '');
    expect(held).toMatch(
      new RegExp(`^\\d{4}-\\d{2}-\\d{2}T\\d{6}Z-frame-${frameId}$`),
    );
    expect(
      JSON.parse(await readFile(path.join(folder, 'frame.json'), 'utf8')),
    ).toMatchObject({
      schema: 1,
      roll: { roll: '2026-014' },
      frame: { id: frameId, number: '12' },
    });
    const scans: string[] = [];
    for await (const file of glob('**/12340012.jpg', { cwd: folder })) {
      scans.push(file);
    }
    expect(scans).toHaveLength(1);
    expect(
      new Uint8Array(await readFile(path.join(folder, scans[0] ?? ''))),
    ).toEqual(scan);
    expect(
      await readdir(path.join(archive.path(), 'rolls/2026/2026-014/frames')),
    ).toEqual([]);
  });

  test('requires If-Match', async () => {
    const { url } = await aScannedFrame();

    expect((await deleteFrame(url)).status).toBe(428);
  });

  test('refuses a stale If-Match, keeping the frame', async () => {
    const { rollId, url, etag } = await aScannedFrame();
    await post(`/api/rolls/${rollId}/frames`, {});

    expect((await deleteFrame(url, etag)).status).toBe(409);
    const roll: unknown = await (await request(`/api/rolls/${rollId}`)).json();
    expect(roll).toMatchObject({ frames: [{ number: '12' }, {}] });
  });

  test('returns 404 for a frame the roll does not have', async () => {
    const { rollId, etag } = await aScannedFrame();

    expect(
      (
        await deleteFrame(
          `/api/rolls/${rollId}/frames/01JC8Z7K3M0000000000000000`,
          etag,
        )
      ).status,
    ).toBe(404);
  });
});
