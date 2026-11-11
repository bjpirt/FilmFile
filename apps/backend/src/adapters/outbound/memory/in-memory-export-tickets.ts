import { randomUUID } from 'node:crypto';
import type { Clock } from '../../../application/ports/clock.ts';
import type {
  ExportTickets,
  QuickExport,
} from '../../../application/ports/export-tickets.ts';

const lifetimeMilliseconds = 5 * 60 * 1000;

/** Tickets kept in memory, which is all they need: they're for one download, moments from now. */
export class InMemoryExportTickets implements ExportTickets {
  readonly #clock: Clock;
  readonly #issued = new Map<
    string,
    { readonly quick: QuickExport; readonly expires: number }
  >();

  constructor(clock: Clock) {
    this.#clock = clock;
  }

  issue(quick: QuickExport): string {
    const now = this.#clock.now().getTime();
    // Forget the ones that ran out, so the list can't grow for ever.
    for (const [ticket, { expires }] of this.#issued) {
      if (expires <= now) {
        this.#issued.delete(ticket);
      }
    }
    const ticket = randomUUID();
    this.#issued.set(ticket, { quick, expires: now + lifetimeMilliseconds });
    return ticket;
  }

  redeem(ticket: string): QuickExport | undefined {
    const found = this.#issued.get(ticket);
    this.#issued.delete(ticket);
    return found !== undefined && found.expires > this.#clock.now().getTime()
      ? found.quick
      : undefined;
  }
}
