import { describe, expect, test } from 'vitest';
import type { Clock } from '../../src/application/ports/clock.ts';
import type {
  ExportTickets,
  QuickExport,
} from '../../src/application/ports/export-tickets.ts';
import { checked } from '../support/checked.ts';
import { isFrameId, isRollId } from '../../src/domain/shared/ids.ts';

/** A clock the test moves on. */
export class MovableClock implements Clock {
  #at = new Date('2026-11-02T12:00:00.000Z').getTime();

  now(): Date {
    return new Date(this.#at);
  }

  advance(minutes: number): void {
    this.#at += minutes * 60_000;
  }
}

const quick: QuickExport = {
  rollId: checked('01JC8Z7K3M0000000002026014', isRollId),
  frameId: checked('01JC8Z7K3M0000000000000001', isFrameId),
  recipe: { longestEdge: 2048, quality: 90 },
};

/** What every ExportTickets must do, run against each adapter. */
export function exportTicketsContract(
  name: string,
  make: (clock: Clock) => ExportTickets,
): void {
  describe(`${name} meets the ExportTickets contract`, () => {
    test('gives the export back once, and then no more', () => {
      const tickets = make(new MovableClock());
      const ticket = tickets.issue(quick);

      expect(tickets.redeem(ticket)).toEqual(quick);
      expect(tickets.redeem(ticket)).toBeUndefined();
    });

    test('gives each export its own ticket', () => {
      const tickets = make(new MovableClock());

      expect(tickets.issue(quick)).not.toBe(tickets.issue(quick));
    });

    test('knows no ticket it did not issue', () => {
      expect(make(new MovableClock()).redeem('nope')).toBeUndefined();
    });

    test('lets a ticket run out', () => {
      const clock = new MovableClock();
      const tickets = make(clock);
      const ticket = tickets.issue(quick);

      clock.advance(6);

      expect(tickets.redeem(ticket)).toBeUndefined();
    });
  });
}
