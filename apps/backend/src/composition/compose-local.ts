import type { OpenAPIHono } from '@hono/zod-openapi';
import type { ReportError } from '../adapters/inbound/http/middleware/error-handler.ts';
import { NodeClock } from '../adapters/outbound/node/node-clock.ts';
import { UlidGenerator } from '../adapters/outbound/node/ulid-generator.ts';
import type { Clock } from '../application/ports/clock.ts';
import type { IdGenerator } from '../application/ports/id-generator.ts';
import { createApp } from '../adapters/inbound/http/create-app.ts';

/** Wires the service for running on this machine. */
export function composeLocal(config: {
  readonly archivePath: string;
  readonly cachePath: string;
  readonly uiPath?: string;
  readonly port: number;
  readonly uiOrigin?: string;
  readonly reportError?: ReportError;
  // Tests pass a fixed clock and sequential IDs.
  readonly clock?: Clock;
  readonly ids?: IdGenerator;
}): OpenAPIHono {
  return createApp({
    ...config,
    clock: config.clock ?? new NodeClock(),
    ids: config.ids ?? new UlidGenerator(),
  });
}
