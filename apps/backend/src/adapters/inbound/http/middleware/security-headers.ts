import type { MiddlewareHandler } from 'hono';

const strictPolicy = "default-src 'self'; frame-ancestors 'none'";

// Swagger UI sets inline styles and uses data: images in its stylesheet. It
// still runs no scripts but its own.
const docsPolicy = `${strictPolicy}; style-src 'self' 'unsafe-inline'; img-src 'self' data:`;

/**
 * Headers for every response: only this service's own scripts, styles and
 * images; never shown inside another site's frame; content types never
 * guessed; and no referrer sent onwards.
 */
export function securityHeaders(): MiddlewareHandler {
  return async (c, next) => {
    await next();
    c.res.headers.set(
      'Content-Security-Policy',
      c.req.path.startsWith('/api/docs') ? docsPolicy : strictPolicy,
    );
    c.res.headers.set('X-Content-Type-Options', 'nosniff');
    c.res.headers.set('Referrer-Policy', 'no-referrer');
  };
}
