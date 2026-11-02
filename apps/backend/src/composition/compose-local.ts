import type { OpenAPIHono } from '@hono/zod-openapi';
import type { ReportError } from '../adapters/inbound/http/middleware/error-handler.ts';
import { createApp } from '../adapters/inbound/http/create-app.ts';

/** Wires the service for running on this machine. */
export function composeLocal(config: {
  readonly archivePath: string;
  readonly cachePath: string;
  readonly uiPath?: string;
  readonly port: number;
  readonly uiOrigin?: string;
  readonly reportError?: ReportError;
}): OpenAPIHono {
  return createApp(config);
}
