import { describe, expect, test } from 'vitest';
import type { EventRepository } from '../../src/application/ports/event-repository.ts';
import { err, ok } from '../../src/domain/shared/result.ts';
import { anEvent, ctx } from '../support/builders.ts';

/** What every EventRepository must do, run against each adapter. */
export function eventRepositoryContract(
  name: string,
  makeRepository: () => EventRepository,
): void {
  describe(`${name} meets the EventRepository contract`, () => {
    test('gets back exactly the event created', async () => {
      const events = makeRepository();
      const event = anEvent('Iceland 2026');

      expect(await events.create(ctx, event)).toEqual(ok(undefined));
      expect(await events.get(ctx, event.slug)).toEqual(event);
    });

    test('refuses to create an event whose slug is taken, keeping the first', async () => {
      const events = makeRepository();
      await events.create(ctx, anEvent('Iceland 2026'));

      expect(
        await events.create(ctx, {
          ...anEvent('Iceland 2026'),
          name: 'ICELAND 2026',
        }),
      ).toEqual(
        err({ kind: 'already-exists', entity: 'event', id: 'iceland-2026' }),
      );
      expect(await events.list(ctx)).toEqual([anEvent('Iceland 2026')]);
    });

    test('lists events in name order', async () => {
      const events = makeRepository();
      for (const name of ['Westfjords', 'autumn walks', 'Iceland 2026']) {
        await events.create(ctx, anEvent(name));
      }

      expect((await events.list(ctx)).map((event) => event.name)).toEqual([
        'autumn walks',
        'Iceland 2026',
        'Westfjords',
      ]);
    });

    test('lists nothing when there are no events', async () => {
      expect(await makeRepository().list(ctx)).toEqual([]);
    });

    test('gets nothing for a slug no event has', async () => {
      expect(
        await makeRepository().get(ctx, anEvent('Iceland 2026').slug),
      ).toBeUndefined();
    });
  });
}
