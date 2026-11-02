import type { OpenAPIHono } from '@hono/zod-openapi';
import { createApp } from '../adapters/inbound/http/create-app.ts';

/** Wires the service for running on this machine. */
export function composeLocal(config: {
  readonly archivePath: string;
  readonly cachePath: string;
}): OpenAPIHono {
  return createApp(config);
}
