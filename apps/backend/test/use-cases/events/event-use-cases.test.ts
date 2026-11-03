import { describe, expect, test } from 'vitest';
import { InMemoryEventRepository } from '../../../src/adapters/outbound/memory/in-memory-event-repository.ts';
import { CreateEvent } from '../../../src/application/use-cases/events/create-event.ts';
import { ListEvents } from '../../../src/application/use-cases/events/list-events.ts';
import { ctx } from '../../support/builders.ts';

function setUp() {
  const events = new InMemoryEventRepository();
  return {
    createEvent: new CreateEvent(events),
    listEvents: new ListEvents(events),
  };
}

describe('CreateEvent', () => {
  test('creates an event with a slug made from its name, trimmed', async () => {
    const { createEvent, listEvents } = setUp();

    const created = await createEvent.execute(ctx, {
      name: ' Iceland 2026 ',
    });

    const event = { slug: 'iceland-2026', name: 'Iceland 2026' };
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
