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
      date: null,
    });
    expect(
      JSON.parse(
        await readFile(
          path.join(archive.path(), 'events/iceland-2026.json'),
          'utf8',
        ),
      ),
    ).toEqual({ schema: 1, name: 'Iceland 2026', date: null });
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
  test('lists the events newest first, with undated events last', async () => {
    await post('/api/events', { name: 'Undated' });
    await post('/api/events', { name: 'Westfjords', date: '2025-06' });
    await post('/api/events', { name: 'Iceland 2026', date: '2026-09-12' });

    expect(await (await request('/api/events')).json()).toEqual({
      events: [
        { slug: 'iceland-2026', name: 'Iceland 2026', date: '2026-09-12' },
        { slug: 'westfjords', name: 'Westfjords', date: '2025-06' },
        { slug: 'undated', name: 'Undated', date: null },
      ],
    });
  });
});

describe('PATCH /api/events/{slug}', () => {
  async function anEvent() {
    await post('/api/events', { name: 'Iceland' });
    const url = '/api/events/iceland';
    const etag = (await request(url)).headers.get('ETag') ?? '';
    return { url, etag };
  }

  function patch(url: string, body: unknown, ifMatch?: string) {
    return request(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(ifMatch === undefined ? {} : { 'If-Match': ifMatch }),
      },
      body: JSON.stringify(body),
    });
  }

  test('renames the event and sets its date, keeping its slug', async () => {
    const { url, etag } = await anEvent();

    const response = await patch(
      url,
      { name: 'Iceland 2026', date: '2026-09' },
      etag,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      slug: 'iceland',
      name: 'Iceland 2026',
      date: '2026-09',
    });
    expect(response.headers.get('ETag')).toBe(
      (await request(url)).headers.get('ETag'),
    );
  });

  test('requires If-Match', async () => {
    const { url } = await anEvent();

    expect((await patch(url, { name: 'x' })).status).toBe(428);
  });

  test('refuses a stale If-Match, keeping the other change', async () => {
    const { url, etag } = await anEvent();
    await patch(url, { name: 'Island' }, etag);

    expect((await patch(url, { name: 'Ísland' }, etag)).status).toBe(409);
    expect(await (await request(url)).json()).toMatchObject({ name: 'Island' });
  });

  test.each([
    ['a date that is not a date', { date: '2026-02-30' }],
    ['a date with a time', { date: '2026-09-12T10:00' }],
    ['a blank name', { name: '' }],
  ])('refuses %s', async (_, body) => {
    const { url, etag } = await anEvent();

    expect((await patch(url, body, etag)).status).toBe(422);
  });

  test('returns 404 for a slug no event has', async () => {
    expect(
      (await patch('/api/events/nowhere', { name: 'x' }, '"1"')).status,
    ).toBe(404);
  });
});

describe('a roll’s event', () => {
  test('is recorded when the roll is created, and cleared with its details', async () => {
    await post('/api/events', { name: 'Iceland 2026' });
    const created: unknown = await (
      await post('/api/rolls', {
        roll: '2026-014',
        event: 'iceland-2026',
        shot: '2026',
      })
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
      shot: '2026',
    });

    expect(await response.json()).toMatchObject({
      issues: [{ path: ['event'] }],
    });
  });
});
