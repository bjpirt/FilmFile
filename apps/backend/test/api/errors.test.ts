import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { beforeEach, expect, test } from 'vitest';
import { composeLocal } from '../../src/composition/compose-local.ts';
import { origin, port } from '../support/api.ts';
import { useTempArchive } from '../support/temp-archive.ts';

const archive = useTempArchive();

beforeEach(async () => {
  // A roll.json that isn't JSON: something the service doesn't expect.
  const folder = path.join(archive.path(), 'rolls/2026/2026-014');
  await mkdir(folder, { recursive: true });
  await writeFile(path.join(folder, 'roll.json'), '{ not json');
});

function correlationIdOf(body: unknown): unknown {
  return typeof body === 'object' && body !== null && 'correlationId' in body
    ? body.correlationId
    : undefined;
}

function requestRolls() {
  const reports: { correlationId: string; error: unknown }[] = [];
  const app = composeLocal({
    archivePath: archive.path(),
    cachePath: archive.cachePath(),
    port,
    reportError: (correlationId, error) => {
      reports.push({ correlationId, error });
    },
  });
  const response = Promise.resolve(app.request(`${origin}/api/rolls`));
  return { response, reports };
}

test('an unexpected error gives a generic 500 with an ID to quote', async () => {
  const response = await requestRolls().response;
  const body: unknown = await response.json();

  expect(response.status).toBe(500);
  expect(body).toEqual({
    error: 'Something went wrong. The service has logged it with this ID.',
    correlationId: correlationIdOf(body),
  });
  expect(correlationIdOf(body)).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
});

test('the 500 reveals nothing about the service, such as file paths', async () => {
  const text = await (await requestRolls().response).text();

  expect(text).not.toContain(archive.path());
  expect(text).not.toMatch(/roll\.json|SyntaxError|at .*\.ts/);
});

test('the error is reported with the same ID', async () => {
  const { response, reports } = requestRolls();
  const body: unknown = await (await response).json();

  expect(reports).toHaveLength(1);
  expect(reports[0]?.error).toBeInstanceOf(SyntaxError);
  expect(correlationIdOf(body)).toBe(reports[0]?.correlationId);
});
