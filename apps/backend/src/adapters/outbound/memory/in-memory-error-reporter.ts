import type { ErrorReporter } from '../../../application/ports/error-reporter.ts';

/** One failure reported: what was being done, and what was thrown. */
export interface Reported {
  readonly what: string;
  readonly error: unknown;
}

/** Keeps what it's told, in order, for tests to read. */
export class InMemoryErrorReporter implements ErrorReporter {
  readonly #reported: Reported[] = [];

  get reported(): readonly Reported[] {
    return this.#reported;
  }

  report(what: string, error: unknown): void {
    this.#reported.push({ what, error });
  }
}
