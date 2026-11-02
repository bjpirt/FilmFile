import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Hono } from 'hono';

// Swagger UI, served from the installed package rather than a CDN (D2), so the
// page works offline and the CSP needs no exceptions. The page has no inline
// script: docs.js starts Swagger UI.

const swaggerUi = path.dirname(
  fileURLToPath(import.meta.resolve('swagger-ui-dist/package.json')),
);

const page = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>FilmFile API</title>
    <link rel="stylesheet" href="/api/docs/swagger-ui.css" />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="/api/docs/swagger-ui-bundle.js"></script>
    <script src="/api/docs/docs.js"></script>
  </body>
</html>
`;

const start = `SwaggerUIBundle({ url: '/api/openapi.json', dom_id: '#swagger-ui' });\n`;

const assets = {
  'swagger-ui-bundle.js': 'text/javascript; charset=utf-8',
  'swagger-ui.css': 'text/css; charset=utf-8',
} as const;

export function docsRoutes(): Hono {
  const routes = new Hono();

  routes.get('/', (c) => c.html(page));
  routes.get('/docs.js', (c) =>
    c.body(start, 200, { 'Content-Type': 'text/javascript; charset=utf-8' }),
  );
  for (const [file, contentType] of Object.entries(assets)) {
    routes.get(`/${file}`, async (c) =>
      c.body(await readFile(path.join(swaggerUi, file)), 200, {
        'Content-Type': contentType,
      }),
    );
  }

  return routes;
}
