import { createApiClient } from '@filmfile/contracts/client';
import { expect, test } from 'vitest';
import { composeLocal } from '../../src/composition/compose-local.ts';
import { aJpeg } from '../support/a-jpeg.ts';
import { origin, port } from '../support/api.ts';
import { useTempArchive } from '../support/temp-archive.ts';

const archive = useTempArchive();

function client() {
  const app = composeLocal({
    folderPath: archive.folder(),
    archivePath: archive.path(),
    cachePath: archive.cachePath(),
    port,
  });
  // A browser adds the Origin header itself; here the test plays the browser.
  return createApiClient({
    baseUrl: origin,
    headers: { Origin: origin },
    fetch: (request) => Promise.resolve(app.request(request)),
  });
}

test('the typed client creates and lists rolls', async () => {
  const api = client();

  const created = await api.POST('/api/rolls', { body: { roll: '2026-014' } });
  const listed = await api.GET('/api/rolls');

  expect(created.response.status).toBe(201);
  expect(listed.data).toEqual({ rolls: [created.data], unreadable: [] });
});

test('the typed client returns the error body for a failed request', async () => {
  const { response, error } = await client().GET('/api/rolls/{rollId}', {
    params: { path: { rollId: '01JC8Z7K3M0000000000000000' } },
  });

  expect(response.status).toBe(404);
  expect(error).toEqual({
    error: 'no roll with ID 01JC8Z7K3M0000000000000000',
  });
});

test('the typed client uploads a scan as a file', async () => {
  const api = client();
  const roll = await api.POST('/api/rolls', { body: { roll: '2026-014' } });
  const rollId = String(roll.data?.id);
  const frame = await api.POST('/api/rolls/{rollId}/frames', {
    params: { path: { rollId } },
    body: {},
  });
  const frameId = String(frame.data?.id);
  const scan = new File([new Uint8Array(await aJpeg())], '12340014.jpg', {
    type: 'image/jpeg',
  });

  const { response, data } = await api.POST(
    '/api/rolls/{rollId}/frames/{frameId}/versions',
    {
      params: { path: { rollId, frameId }, query: { file: scan.name } },
      body: scan,
      bodySerializer: (body) => body,
      headers: { 'Content-Type': 'image/jpeg' },
    },
  );

  expect(response.status).toBe(201);
  expect(data?.bytes).toBe(scan.size);
});
