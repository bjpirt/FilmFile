import { createApiClient } from '@filmfile/contracts/client';
import { expect, test } from 'vitest';
import { composeLocal } from '../../src/composition/compose-local.ts';
import { useTempArchive } from '../support/temp-archive.ts';

const archive = useTempArchive();

function client() {
  const app = composeLocal({
    archivePath: archive.path(),
    cachePath: archive.cachePath(),
  });
  return createApiClient({
    baseUrl: 'http://localhost',
    fetch: (request) => Promise.resolve(app.request(request)),
  });
}

test('the typed client creates and lists rolls', async () => {
  const api = client();

  const created = await api.POST('/api/rolls', { body: { roll: '2026-014' } });
  const listed = await api.GET('/api/rolls');

  expect(created.response.status).toBe(201);
  expect(listed.data).toEqual([created.data]);
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
