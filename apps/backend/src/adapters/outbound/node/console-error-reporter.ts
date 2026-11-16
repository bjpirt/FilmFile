import type { ErrorReporter } from '../../../application/ports/error-reporter.ts';

/** Reports to the service's error output, where a request's errors go too; the error is passed whole so its stack is printed. */
export class ConsoleErrorReporter implements ErrorReporter {
  report(what: string, error: unknown): void {
    console.error(`${what}:`, error);
  }
}
