import { expect, test } from 'vitest';
import { apiFor } from '../support/api.ts';
import { useTempArchive } from '../support/temp-archive.ts';

const { request } = apiFor(useTempArchive());

test('reports that the service is up', async () => {
  const response = await request('/api/health');

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ status: 'ok' });
});
