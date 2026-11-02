import type { ErrorHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { newUlid } from '../../../outbound/node/new-ulid.ts';

export type ReportError = (correlationId: string, error: unknown) => void;

export function reportToConsole(correlationId: string, error: unknown): void {
  console.error(`Error ${correlationId}:`, error);
}

/**
 * Hono's own errors, such as malformed JSON, keep their status and message.
 * Anything else is a bug: the client gets an ID to quote and nothing else,
 * since details such as file paths and stack traces stay in the log.
 */
export function errorHandler(reportError: ReportError): ErrorHandler {
  return (error, c) => {
    if (error instanceof HTTPException) {
      return c.json({ error: error.message }, error.status);
    }
    const correlationId = newUlid();
    reportError(correlationId, error);
    return c.json(
      {
        error: 'Something went wrong. The service has logged it with this ID.',
        correlationId,
      },
      500,
    );
  };
}
