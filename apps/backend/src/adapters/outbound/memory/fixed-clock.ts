import type { Clock } from '../../../application/ports/clock.ts';

/** Always the same time, so tests can say exactly what was recorded. */
export class FixedClock implements Clock {
  readonly #at: Date;

  constructor(at: string) {
    this.#at = new Date(at);
  }

  now(): Date {
    return new Date(this.#at);
  }
}
