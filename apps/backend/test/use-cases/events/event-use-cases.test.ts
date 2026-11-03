import { describe, expect, test } from 'vitest';
import { InMemoryEventRepository } from '../../../src/adapters/outbound/memory/in-memory-event-repository.ts';
import { CreateEvent } from '../../../src/application/use-cases/events/create-event.ts';
import { GetEvent } from '../../../src/application/use-cases/events/get-event.ts';
import { ListEvents } from '../../../src/application/use-cases/events/list-events.ts';
import { UpdateEvent } from '../../../src/application/use-cases/events/update-event.ts';
import { checked } from '../../support/checked.ts';
import { ctx } from '../../support/builders.ts';
import { isSlug } from '../../../src/domain/shared/slug.ts';

function setUp() {
  const events = new InMemoryEventRepository();
  return {
    createEvent: new CreateEvent(events),
    listEvents: new ListEvents(events),
    getEvent: new GetEvent(events),
    updateEvent: new UpdateEvent(events),
  };
}

describe('CreateEvent', () => {
  test('creates an event with a slug made from its name, trimmed', async () => {
    const { createEvent, listEvents } = setUp();

    const created = await createEvent.execute(ctx, {
      name: ' Iceland 2026 ',
    });

    const event = { slug: 'iceland-2026', name: 'Iceland 2026', date: null };
    expect(created).toEqual({ ok: true, value: event });
    expect(await listEvents.execute(ctx)).toEqual([event]);
  });

  test('refuses an event whose slug another event has', async () => {
    const { createEvent } = setUp();
    await createEvent.execute(ctx, { name: 'Iceland 2026' });

    expect(await createEvent.execute(ctx, { name: 'iceland  2026' })).toEqual({
      ok: false,
      error: { kind: 'already-exists', entity: 'event', id: 'iceland-2026' },
    });
  });

  test('refuses a name with no letters or digits', async () => {
    const { createEvent } = setUp();

    expect(await createEvent.execute(ctx, { name: ' ? ' })).toMatchObject({
      ok: false,
      error: { kind: 'validation-failed', issues: [{ path: ['name'] }] },
    });
  });
});

describe('CreateEvent with a date', () => {
  test('keeps the date given', async () => {
    const { createEvent } = setUp();

    expect(
      await createEvent.execute(ctx, { name: 'Iceland 2026', date: '2026-09' }),
    ).toMatchObject({ ok: true, value: { date: '2026-09' } });
  });

  test('refuses a date that is not a date', async () => {
    const { createEvent } = setUp();

    expect(
      await createEvent.execute(ctx, { name: 'Iceland', date: '2026-02-30' }),
    ).toMatchObject({
      ok: false,
      error: { kind: 'validation-failed', issues: [{ path: ['date'] }] },
    });
  });
});

describe('ListEvents', () => {
  test('lists events newest first, with undated events last', async () => {
    const { createEvent, listEvents } = setUp();
    await createEvent.execute(ctx, { name: 'Undated' });
    await createEvent.execute(ctx, { name: 'Westfjords', date: '2025-06' });
    await createEvent.execute(ctx, { name: 'Iceland', date: '2026-09-12' });

    expect((await listEvents.execute(ctx)).map((e) => e.name)).toEqual([
      'Iceland',
      'Westfjords',
      'Undated',
    ]);
  });
});

describe('UpdateEvent', () => {
  const slug = checked('iceland', isSlug);

  async function anEventRead(date: string | null = null) {
    const setup = setUp();
    await setup.createEvent.execute(ctx, { name: 'Iceland', date });
    const read = await setup.getEvent.execute(ctx, { slug });
    if (!read.ok) {
      throw new Error('setup failed');
    }
    return { ...setup, version: read.value.version };
  }

  test('renames the event and sets its date, keeping its slug', async () => {
    const { updateEvent, getEvent, version } = await anEventRead();

    const updated = await updateEvent.execute(ctx, {
      slug,
      expectedVersion: version,
      name: ' Iceland 2026 ',
      date: '2026-09',
    });

    expect(updated).toEqual(await getEvent.execute(ctx, { slug }));
    expect(updated).toMatchObject({
      ok: true,
      value: {
        event: { slug: 'iceland', name: 'Iceland 2026', date: '2026-09' },
      },
    });
  });

  test('clears the date with null, leaving the name', async () => {
    const { updateEvent, version } = await anEventRead('2026');

    expect(
      await updateEvent.execute(ctx, {
        slug,
        expectedVersion: version,
        date: null,
      }),
    ).toMatchObject({
      ok: true,
      value: { event: { name: 'Iceland', date: null } },
    });
  });

  test('refuses when the event changed since it was read', async () => {
    const { updateEvent, version } = await anEventRead();
    await updateEvent.execute(ctx, {
      slug,
      expectedVersion: version,
      name: 'Island',
    });

    expect(
      await updateEvent.execute(ctx, {
        slug,
        expectedVersion: version,
        name: 'Ísland',
      }),
    ).toMatchObject({ ok: false, error: { kind: 'concurrency-conflict' } });
  });

  test('refuses a blank name or a date that is not a date', async () => {
    const { updateEvent, version } = await anEventRead();

    expect(
      await updateEvent.execute(ctx, {
        slug,
        expectedVersion: version,
        name: ' ',
      }),
    ).toMatchObject({ ok: false, error: { kind: 'validation-failed' } });
    expect(
      await updateEvent.execute(ctx, {
        slug,
        expectedVersion: version,
        date: 'September',
      }),
    ).toMatchObject({ ok: false, error: { kind: 'validation-failed' } });
  });

  test('says when no event has the slug', async () => {
    const { updateEvent } = setUp();

    expect(
      await updateEvent.execute(ctx, { slug, expectedVersion: '1', name: 'x' }),
    ).toEqual({
      ok: false,
      error: { kind: 'not-found', entity: 'event', id: 'iceland' },
    });
  });
});
