import type { MiddlewareHandler } from 'hono';

const readOnlyMethods = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Refuses requests that don't come from the FilmFile UI or a tool on this
 * machine. Any web page the user visits can send requests to localhost:
 * - a Host other than this machine on our port means DNS rebinding;
 * - an Origin other than the UI's means another site's page sent it;
 * - a change with no Origin didn't come from a browser page we can trust.
 *   Browsers always send Origin with these, so only tools omit it, and they
 *   can send it.
 */
export function requestGuard({
  port,
  uiOrigin,
}: {
  readonly port: number;
  readonly uiOrigin?: string;
}): MiddlewareHandler {
  const hosts = ['127.0.0.1', 'localhost', '[::1]'].map(
    (host) => `${host}:${String(port)}`,
  );
  const origins = new Set(hosts.map((host) => `http://${host}`));
  if (uiOrigin !== undefined) {
    origins.add(uiOrigin);
  }

  return async (c, next) => {
    // The server builds the request URL from the Host header.
    const host = new URL(c.req.url).host;
    const origin = c.req.header('Origin');
    const allowed =
      hosts.includes(host) &&
      (origin === undefined
        ? readOnlyMethods.has(c.req.method)
        : origins.has(origin));
    if (!allowed) {
      return c.json({ error: 'request refused' }, 403);
    }
    await next();
  };
}
