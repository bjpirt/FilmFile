import type { MiddlewareHandler } from 'hono';

/**
 * Refuses (415) a body of any other type. A cross-site HTML form can only send
 * text/plain, form or multipart bodies, so this keeps forms out of the API.
 */
export function requireContentType(mediaType: string): MiddlewareHandler {
  return async (c, next) => {
    // Ignore parameters such as `; charset=utf-8`.
    const sent = c.req
      .header('Content-Type')
      ?.split(';')[0]
      ?.trim()
      .toLowerCase();
    if (sent !== mediaType) {
      return c.json({ error: `Content-Type must be ${mediaType}` }, 415);
    }
    await next();
  };
}
