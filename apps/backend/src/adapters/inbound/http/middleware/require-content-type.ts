import type { MiddlewareHandler } from 'hono';

/**
 * Refuses (415) a body of any type but those given. A cross-site HTML form
 * can only send text/plain, form or multipart bodies, so this keeps forms out
 * of the API.
 */
export function requireContentType(
  ...mediaTypes: readonly [string, ...string[]]
): MiddlewareHandler {
  return async (c, next) => {
    // Ignore parameters such as `; charset=utf-8`.
    const sent = c.req
      .header('Content-Type')
      ?.split(';')[0]
      ?.trim()
      .toLowerCase();
    if (sent === undefined || !mediaTypes.includes(sent)) {
      return c.json(
        {
          error:
            mediaTypes.length === 1
              ? `Content-Type must be ${mediaTypes.join('')}`
              : `Content-Type must be one of ${mediaTypes.join(', ')}`,
        },
        415,
      );
    }
    await next();
  };
}
