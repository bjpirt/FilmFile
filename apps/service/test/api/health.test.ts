import { expect, test } from 'vitest';
import { composeLocal } from '../../src/composition/compose-local.ts';

test('reports that the service is up', async () => {
  const app = composeLocal({ archivePath: '/unused', cachePath: '/unused' });

  const response = await app.request('/api/health');

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ status: 'ok' });
});
