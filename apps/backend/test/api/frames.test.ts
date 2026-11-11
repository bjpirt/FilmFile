import { glob, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import { aJpeg } from '../support/a-jpeg.ts';
import { apiFor, idOf } from '../support/api.ts';
import { folderOfRoll } from '../support/roll-folder.ts';
import { useTempArchive } from '../support/temp-archive.ts';

const archive = useTempArchive();
const { request, post } = apiFor(archive);

async function aRoll(): Promise<string> {
  const created: unknown = await (
    await post('/api/rolls', { roll: '2026-014', shot: '2026' })
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
      title: null,
      rating: null,
      notes: null,
      camera: null,
      lens: null,
      event: null,
      toScan: false,
      shot: null,
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
      title: null,
      rating: null,
      notes: null,
      camera: null,
      lens: null,
      event: null,
      toScan: false,
      shot: null,
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

  test('marks a frame to scan and can clear the mark', async () => {
    const { url, etag } = await aRollWithAFrame();
    const marked = await patch(url, { toScan: true }, etag);

    expect(marked.status).toBe(200);
    expect(await marked.json()).toMatchObject({ toScan: true });

    const cleared = await patch(
      url,
      { toScan: false },
      marked.headers.get('ETag') ?? '',
    );
    expect(cleared.status).toBe(200);
    expect(await cleared.json()).toMatchObject({ toScan: false });
  });

  test('refuses a non-boolean scan mark', async () => {
    const { url, etag } = await aRollWithAFrame();

    expect((await patch(url, { toScan: 'yes' }, etag)).status).toBe(422);
  });

  test('describes the frame with a title, rating and notes', async () => {
    const { rollId, url, etag } = await aRollWithAFrame();

    const response = await patch(
      url,
      { title: 'Mill pond', rating: 5, notes: 'Early fog' },
      etag,
    );

    const described = { title: 'Mill pond', rating: 5, notes: 'Early fog' };
    expect(await response.json()).toMatchObject(described);
    expect(await (await request(`/api/rolls/${rollId}`)).json()).toMatchObject({
      frames: [described],
    });
  });

  test.each([0, 6, 2.5])('refuses a rating of %d', async (rating) => {
    const { url, etag } = await aRollWithAFrame();

    const response = await patch(url, { rating }, etag);

    expect(response.status).toBe(422);
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

  test('gives many frames the same event in one save', async () => {
    await post('/api/equipment/cameras', { make: 'Leica', model: 'M6' });
    await post('/api/events', { name: 'Westfjords' });
    const { frameIds, url, etag } = await aRollWithFrames(3);

    const response = await patchNumbers(
      url,
      {
        frameIds: [frameIds[0], frameIds[2]],
        camera: 'leica-m6',
        event: 'westfjords',
        toScan: true,
      },
      etag,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('ETag')).not.toBe(etag);
    expect(await response.json()).toMatchObject({
      frames: [
        { camera: 'leica-m6', event: 'westfjords', toScan: true },
        { camera: null, event: null, toScan: false },
        { camera: 'leica-m6', event: 'westfjords', toScan: true },
      ],
    });
  });

  test('refuses an event that is not in the archive and changes no frames', async () => {
    const { frameIds, rollId, url, etag } = await aRollWithFrames(1);

    expect(
      (await patchNumbers(url, { frameIds, event: 'nowhere' }, etag)).status,
    ).toBe(422);
    const roll: unknown = await (await request(`/api/rolls/${rollId}`)).json();
    expect(roll).toMatchObject({ frames: [{ event: null }] });
  });

  test.each([
    ['no frames', { frameIds: [], camera: null }, 422],
    ['a camera not in the archive', { camera: 'nikon-f3' }, 422],
    ['numbers and details together', { numbers: [], camera: null }, 422],
    // A frame's film stock is always its roll's (D45).
    ['a film stock', { film: 'kodak-gold-200' }, 422],
  ])('refuses %s', async (_case, change, status) => {
    const { frameIds, url, etag } = await aRollWithFrames(1);

    expect(
      (await patchNumbers(url, { frameIds, ...change }, etag)).status,
    ).toBe(status);
  });

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

describe('DELETE /api/rolls/{id}/frames', () => {
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
    return { rollId, frameIds, etag: etag ?? '' };
  }

  function deleteFrames(rollId: string, ids: string, ifMatch?: string) {
    return request(`/api/rolls/${rollId}/frames?frameIds=${ids}`, {
      method: 'DELETE',
      headers: ifMatch === undefined ? {} : { 'If-Match': ifMatch },
    });
  }

  test('deletes the frames listed in one save, returning the roll’s new ETag', async () => {
    const { rollId, frameIds, etag } = await aRollWithFrames(3);

    const response = await deleteFrames(
      rollId,
      `${frameIds[0] ?? ''},${frameIds[2] ?? ''}`,
      etag,
    );

    expect(response.status).toBe(204);
    const roll = await request(`/api/rolls/${rollId}`);
    expect(response.headers.get('ETag')).toBe(roll.headers.get('ETag'));
    expect(await roll.json()).toMatchObject({ frames: [{ id: frameIds[1] }] });
    expect(await readdir(path.join(archive.path(), 'deleted'))).toHaveLength(2);
  });

  test.each([
    ['no If-Match', undefined, 428],
    ['a stale If-Match', '"stale"', 409],
  ])('refuses %s', async (_case, ifMatch, status) => {
    const { rollId, frameIds } = await aRollWithFrames(1);

    expect(
      (await deleteFrames(rollId, frameIds[0] ?? '', ifMatch)).status,
    ).toBe(status);
  });

  test.each([
    ['something that isn’t frame IDs', 'nope', 422],
    ['a frame not in the roll', '01JC8Z7K3M0000000000000000', 404],
  ])('refuses %s', async (_case, ids, status) => {
    const { rollId, etag } = await aRollWithFrames(1);

    expect((await deleteFrames(rollId, ids, etag)).status).toBe(status);
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
      await readdir(
        path.join(await folderOfRoll(archive.path(), '2026-014'), 'frames'),
      ),
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

describe('GET /api/rolls/{id}/frames/{frameId}/details', () => {
  test('gives the details the frame inherits, from the archive and its roll', async () => {
    await post('/api/settings', { author: 'Ben Pirt' });
    await post('/api/equipment/cameras', { make: 'Nikon', model: 'FE' });
    await post('/api/events', { name: 'Iceland 2026' });
    const rollId = String(
      idOf(
        await (
          await post('/api/rolls', {
            roll: '2026-014',
            camera: 'nikon-fe',
            event: 'iceland-2026',
            shot: '2026',
          })
        ).json(),
      ),
    );
    const frameId = String(
      idOf(await (await post(`/api/rolls/${rollId}/frames`, {})).json()),
    );

    const response = await request(
      `/api/rolls/${rollId}/frames/${frameId}/details`,
    );

    const body: unknown = await response.json();
    expect(response.status, JSON.stringify(body)).toBe(200);
    const archiveId = idOf(await (await request('/api/settings')).json());
    expect(body).toEqual({
      author: {
        value: 'Ben Pirt',
        source: { layer: 'archive', id: archiveId },
      },
      camera: { value: 'nikon-fe', source: { layer: 'roll', id: rollId } },
      event: { value: 'iceland-2026', source: { layer: 'roll', id: rollId } },
      shot: { value: '2026', source: { layer: 'roll', id: rollId } },
    });
  });

  test('a frame in no event has none, even when its roll has one', async () => {
    await post('/api/events', { name: 'Iceland 2026' });
    const rollId = String(
      idOf(
        await (
          await post('/api/rolls', {
            roll: '2026-014',
            event: 'iceland-2026',
            shot: '2026',
          })
        ).json(),
      ),
    );
    const frameId = String(
      idOf(await (await post(`/api/rolls/${rollId}/frames`, {})).json()),
    );
    const etag = (await request(`/api/rolls/${rollId}`)).headers.get('ETag');

    const patched = await request(`/api/rolls/${rollId}/frames/${frameId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'If-Match': etag ?? '' },
      body: JSON.stringify({ event: false }),
    });

    expect(await patched.json()).toMatchObject({ event: false });
    const details: unknown = await (
      await request(`/api/rolls/${rollId}/frames/${frameId}/details`)
    ).json();
    expect(details).not.toHaveProperty('event');
    const refused = await request(`/api/rolls/${rollId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'If-Match': patched.headers.get('ETag') ?? '',
      },
      body: JSON.stringify({ event: false }),
    });
    expect(refused.status).toBe(422);
  });

  test('the frame’s own camera and event win over its roll’s', async () => {
    await post('/api/equipment/cameras', { make: 'Nikon', model: 'FE' });
    await post('/api/equipment/cameras', { make: 'Leica', model: 'M6' });
    await post('/api/events', { name: 'Iceland 2026' });
    await post('/api/events', { name: 'Westfjords' });
    const rollId = String(
      idOf(
        await (
          await post('/api/rolls', {
            roll: '2026-014',
            camera: 'nikon-fe',
            event: 'iceland-2026',
            shot: '2026',
          })
        ).json(),
      ),
    );
    const frameId = String(
      idOf(await (await post(`/api/rolls/${rollId}/frames`, {})).json()),
    );
    const etag = (await request(`/api/rolls/${rollId}`)).headers.get('ETag');
    const patched = await request(`/api/rolls/${rollId}/frames/${frameId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'If-Match': etag ?? '' },
      body: JSON.stringify({ camera: 'leica-m6', event: 'westfjords' }),
    });
    expect(await patched.json()).toMatchObject({
      camera: 'leica-m6',
      event: 'westfjords',
    });

    const details: unknown = await (
      await request(`/api/rolls/${rollId}/frames/${frameId}/details`)
    ).json();

    const fromFrame = { layer: 'frame', id: frameId };
    expect(details).toEqual({
      camera: { value: 'leica-m6', source: fromFrame },
      event: { value: 'westfjords', source: fromFrame },
      shot: { value: '2026', source: { layer: 'roll', id: rollId } },
    });

    const cleared = await request(`/api/rolls/${rollId}/frames/${frameId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'If-Match': patched.headers.get('ETag') ?? '',
      },
      body: JSON.stringify({ event: null }),
    });
    expect(await cleared.json()).toMatchObject({ event: null });
    const inherited: unknown = await (
      await request(`/api/rolls/${rollId}/frames/${frameId}/details`)
    ).json();
    expect(inherited).toMatchObject({
      event: { value: 'iceland-2026', source: { layer: 'roll', id: rollId } },
    });
  });

  test('says when the roll has no such frame', async () => {
    const rollId = await aRoll();

    expect(
      (
        await request(
          `/api/rolls/${rollId}/frames/01JC8Z7K3M0000000000000000/details`,
        )
      ).status,
    ).toBe(404);
  });
});
