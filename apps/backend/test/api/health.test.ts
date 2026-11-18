import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from 'vitest';
import { z } from 'zod';
import { apiFor } from '../support/api.ts';
import { useTempArchive } from '../support/temp-archive.ts';

const { request } = apiFor(useTempArchive());

// FilmFile's version is kept only in the root package.json (FF-194, D109).
const { version } = z
  .object({ version: z.string() })
  .parse(
    JSON.parse(
      readFileSync(
        path.resolve(import.meta.dirname, '../../../../package.json'),
        'utf8',
      ),
    ),
  );

test('reports that the service is up, with its version, run from source', async () => {
  const response = await request('/api/health');

  expect(response.status).toBe(200);
  expect(version).toMatch(/^\d+\.\d+\.\d+$/);
  expect(await response.json()).toEqual({
    status: 'ok',
    exportToFolder: false,
    version,
    dev: true,
  });
});
