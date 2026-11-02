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

  routes.use('*', serveStatic({ root: uiPath }));
  routes.get('*', serveStatic({ root: uiPath, path: 'index.html' }));
  return routes;
}
