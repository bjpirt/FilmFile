import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import { apiFor, idOf } from '../support/api.ts';
import { useTempArchive } from '../support/temp-archive.ts';

const archive = useTempArchive();
const { request, post } = apiFor(archive);

describe('POST /api/events', () => {
  test('adds an event, saved as its own file named by its slug', async () => {
    const response = await post('/api/events', { name: 'Iceland 2026' });

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      slug: 'iceland-2026',
      name: 'Iceland 2026',
    });
    expect(
      JSON.parse(
        await readFile(
          path.join(archive.path(), 'events/iceland-2026.json'),
          'utf8',
        ),
      ),
    ).toEqual({ schema: 1, name: 'Iceland 2026' });
  });

  test('refuses an event whose slug another event has', async () => {
    await post('/api/events', { name: 'Iceland 2026' });

    expect((await post('/api/events', { name: 'ICELAND 2026' })).status).toBe(
      409,
    );
  });

  test.each([
    ['no name', {}],
    ['a name with no letters or digits', { name: '…' }],
    ['a name that is too long', { name: 'x'.repeat(101) }],
  ])('refuses %s', async (_, body) => {
    expect((await post('/api/events', body)).status).toBe(422);
  });
});

describe('GET /api/events', () => {
  test('lists the events by name', async () => {
    await post('/api/events', { name: 'Westfjords' });
    await post('/api/events', { name: 'Iceland 2026' });

    expect(await (await request('/api/events')).json()).toEqual({
      events: [
        { slug: 'iceland-2026', name: 'Iceland 2026' },
        { slug: 'westfjords', name: 'Westfjords' },
      ],
    });
  });
});

describe('a roll’s event', () => {
  test('is recorded when the roll is created, and cleared with its details', async () => {
    await post('/api/events', { name: 'Iceland 2026' });
    const created: unknown = await (
      await post('/api/rolls', { roll: '2026-014', event: 'iceland-2026' })
    ).json();
    const url = `/api/rolls/${String(idOf(created))}`;
    const etag = (await request(url)).headers.get('ETag') ?? '';

    const changed = await request(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'If-Match': etag },
      body: JSON.stringify({ event: null }),
    });

    expect(created).toMatchObject({ event: 'iceland-2026' });
    expect(await changed.json()).toMatchObject({ event: null });
  });

  test('must be an event in the archive', async () => {
    const response = await post('/api/rolls', {
      roll: '2026-014',
      event: 'iceland-2026',
    });

    expect(await response.json()).toMatchObject({
      issues: [{ path: ['event'] }],
    });
  });
});
