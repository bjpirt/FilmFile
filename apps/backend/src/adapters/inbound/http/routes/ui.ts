import { existsSync } from 'node:fs';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';

/** The built web UI: its files, and its page for any other path, which the UI routes itself. */
export function uiRoutes(uiPath: string): Hono {
  const routes = new Hono();

  if (!existsSync(uiPath)) {
    routes.get('*', (c) =>
      c.text('The UI has not been built. Run pnpm build, then restart.', 404),
    );
    return routes;
  }

  // Vite names each built asset after its content, so assets can be cached for
  // good. The page names the current assets, so browsers check it every time.
  routes.use('*', async (c, next) => {
    await next();
    if (c.res.ok) {
      const isPage = c.res.headers.get('Content-Type')?.startsWith('text/html');
      c.res.headers.set(
        'Cache-Control',
        isPage === true ? 'no-cache' : 'public, max-age=31536000, immutable',
      );
    }
  });
  routes.use('*', serveStatic({ root: uiPath }));
  routes.get('*', serveStatic({ root: uiPath, path: 'index.html' }));
  return routes;
}
