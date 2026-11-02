import type { Hook } from '@hono/zod-openapi';
import type { Env } from 'hono';

/** Answers a request that fails its route's schemas with 422 and each issue's path and message. */
export const invalidRequestHook: Hook<unknown, Env, string, unknown> = (
  result,
  c,
) => {
  if (result.success) {
    return undefined;
  }
  const issues = result.error.issues.map(({ path, message }) => ({
    path,
    message,
  }));
  return c.json({ error: 'invalid request', issues }, 422);
};
