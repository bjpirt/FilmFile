import type { Hono } from 'hono';
import { createApp } from '../adapters/driving/http/create-app.ts';

/** Wires the service for running on this machine. */
export function composeLocal(): Hono {
  return createApp();
}
