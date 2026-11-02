import { Hono } from 'hono';
import { expect, test } from 'vitest';
import type { DomainError } from '../../../domain/shared/domain-error.ts';
import { domainErrorResponse } from './domain-error-response.ts';

async function responseTo(error: DomainError) {
  const app = new Hono().get('/', (c) => domainErrorResponse(c, error));
  const response = await app.request('/');
  const body: unknown = await response.json();
  return { status: response.status, body };
}

test.each<[DomainError, number, unknown]>([
  [
    { kind: 'not-found', entity: 'roll', id: '01JC8Z7K3M0000000000000000' },
    404,
    { error: 'no roll with ID 01JC8Z7K3M0000000000000000' },
  ],
  [
    { kind: 'already-exists', entity: 'roll', id: '2026-014' },
    409,
    { error: 'roll 2026-014 already exists' },
  ],
  [
    {
      kind: 'concurrency-conflict',
      entity: 'roll',
      id: '01JC8Z7K3M0000000000000000',
    },
    409,
    { error: 'the roll has changed since it was read' },
  ],
  [
    {
      kind: 'validation-failed',
      issues: [
        { path: ['roll'], message: 'must be a roll number like 2026-014' },
      ],
    },
    422,
    {
      error: 'invalid request',
      issues: [
        { path: ['roll'], message: 'must be a roll number like 2026-014' },
      ],
    },
  ],
  [
    {
      kind: 'mapping-invalid',
      issues: [{ path: ['anchors', 0], message: 'not numeric' }],
    },
    422,
    {
      error: 'invalid request',
      issues: [{ path: ['anchors', 0], message: 'not numeric' }],
    },
  ],
  [
    { kind: 'scan-already-in-roll', frameId: '01JC8Z7K3M0000000000000002' },
    409,
    {
      error: 'this scan is already in the roll',
      frameId: '01JC8Z7K3M0000000000000002',
    },
  ],
  [
    { kind: 'image-rejected', reason: 'not-jpeg' },
    415,
    { error: 'The file is not a JPEG.' },
  ],
  [
    { kind: 'image-rejected', reason: 'unreadable' },
    422,
    { error: 'The file could not be read as an image.' },
  ],
  [
    {
      kind: 'image-rejected',
      reason: 'too-many-pixels',
      maxPixels: 100_000_000,
    },
    422,
    { error: 'The image has more than 100 megapixels.' },
  ],
])('a %o error is a %i', async (error, status, body) => {
  expect(await responseTo(error)).toEqual({ status, body });
});
