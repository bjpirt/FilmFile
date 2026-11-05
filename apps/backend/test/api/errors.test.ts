import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { beforeEach, expect, test } from 'vitest';
import { composeLocal } from '../../src/composition/compose-local.ts';
import { origin, port } from '../support/api.ts';
import { useTempArchive } from '../support/temp-archive.ts';

const archive = useTempArchive();

const rollId = '01JC8Z7K3M0000000000000001';
const frameId = '01JC8Z7K3M0000000000000002';
const versionId = '01JC8Z7K3M0000000000000003';

beforeEach(async () => {
  // A version whose file has gone from the archive: something the service doesn't expect.
  const folder = path.join(archive.path(), 'rolls/2026/2026-014');
  await mkdir(folder, { recursive: true });
  const version = {
    id: versionId,
    file: 'frames/00000002/00000003/12340014.jpg',
    sha256: 'a'.repeat(64),
    bytes: 6,
    width: 1,
    height: 1,
    added: '2026-11-02T12:00:00.000Z',
  };
  const roll = {
    schema: 1,
    id: rollId,
    roll: '2026-014',
    frames: [{ id: frameId, number: '1', versions: [version] }],
  };
  await writeFile(path.join(folder, 'roll.json'), JSON.stringify(roll));
});

function correlationIdOf(body: unknown): unknown {
  return typeof body === 'object' && body !== null && 'correlationId' in body
    ? body.correlationId
    : undefined;
}

function requestMissingFile() {
  const reports: { correlationId: string; error: unknown }[] = [];
  const app = composeLocal({
    folderPath: archive.folder(),
    archivePath: archive.path(),
    cachePath: archive.cachePath(),
    port,
    reportError: (correlationId, error) => {
      reports.push({ correlationId, error });
    },
  });
  const response = Promise.resolve(
    app.request(
      `${origin}/api/rolls/${rollId}/frames/${frameId}/versions/${versionId}/file`,
    ),
  );
  return { response, reports };
}

test('an unexpected error gives a generic 500 with an ID to quote', async () => {
  const response = await requestMissingFile().response;
  const body: unknown = await response.json();

  expect(response.status).toBe(500);
  expect(body).toEqual({
    error: 'Something went wrong. The service has logged it with this ID.',
    correlationId: correlationIdOf(body),
  });
  expect(correlationIdOf(body)).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
});

test('the 500 reveals nothing about the service, such as file paths', async () => {
  const text = await (await requestMissingFile().response).text();

  expect(text).not.toContain(archive.path());
  expect(text).not.toMatch(/ENOENT|12340014|at .*\.ts/);
});

test('the error is reported with the same ID', async () => {
  const { response, reports } = requestMissingFile();
  const body: unknown = await (await response).json();

  expect(reports).toHaveLength(1);
  expect(String(reports[0]?.error)).toMatch(/ENOENT/);
  expect(correlationIdOf(body)).toBe(reports[0]?.correlationId);
});
