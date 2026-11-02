import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { health } from '@filmfile/contracts/health';
import { HTTPException } from 'hono/http-exception';
import { requestGuard } from './middleware/request-guard.ts';
import { docsRoutes } from './routes/docs.ts';
import { rollRoutes } from './routes/rolls.ts';
import { uiRoutes } from './routes/ui.ts';

const getHealth = createRoute({
  method: 'get',
  path: '/api/health',
  summary: 'Check that the service is up',
  responses: {
    200: {
      description: 'The service is up.',
      content: { 'application/json': { schema: health } },
    },
  },
});

export function createApp(config: {
  readonly archivePath: string;
  readonly cachePath: string;
  readonly uiPath?: string;
  readonly port: number;
  readonly uiOrigin?: string;
}): OpenAPIHono {
  const app = new OpenAPIHono();

  app.use(requestGuard(config));

  app.openapi(getHealth, (c) => c.json({ status: 'ok' } as const, 200));
  app.route('/api/rolls', rollRoutes(config));
  app.doc31('/api/openapi.json', {
    openapi: '3.1.0',
    info: { title: 'FilmFile API', version: '0.0.0' },
  });
  app.route('/api/docs', docsRoutes());
  app.all('/api/*', (c) => c.json({ error: 'not found' }, 404));
  if (config.uiPath !== undefined) {
    app.route('/', uiRoutes(config.uiPath));
  }
  // Hono raises these itself, e.g. for malformed JSON; give them our error shape.
  app.onError((error, c) => {
    if (error instanceof HTTPException) {
      return c.json({ error: error.message }, error.status);
    }
    console.error(error);
    return c.json({ error: 'internal error' }, 500);
  });

  return app;
}
