import { expect, test } from 'vitest';
import { composeInMemory } from '../../src/composition/compose-in-memory.ts';
import { aJpeg } from '../support/a-jpeg.ts';
import { origin } from '../support/api.ts';

test('the in-memory service runs the whole roll workflow, with predictable IDs and times', async () => {
  const app = composeInMemory();
  const send = (url: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);
    headers.set('Origin', origin);
    return app.request(`${origin}${url}`, { ...init, headers });
  };
  const json = (body: unknown): RequestInit => ({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const rolls = '/api/rolls/00000000000000000000000001';
  const version = `${rolls}/frames/00000000000000000000000002/versions/00000000000000000000000003`;
  const scan = new Uint8Array(await aJpeg());

  await send('/api/rolls', json({ roll: '2026-014' }));
  await send(`${rolls}/frames`, json({ number: '1' }));
  const added = await send(
    `${rolls}/frames/00000000000000000000000002/versions?file=12340014.jpg`,
    { method: 'POST', headers: { 'Content-Type': 'image/jpeg' }, body: scan },
  );

  expect(await added.json()).toMatchObject({
    id: '00000000000000000000000003',
    added: '2026-11-02T12:00:00.000Z',
  });
  expect(
    new Uint8Array(await (await send(`${version}/file`)).arrayBuffer()),
  ).toEqual(scan);
  expect((await send(`${version}/thumbnail?size=small`)).status).toBe(200);
});
