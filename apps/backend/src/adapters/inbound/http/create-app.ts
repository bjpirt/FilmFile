import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { health } from '@filmfile/contracts/health';
import type { Clock } from '../../../application/ports/clock.ts';
import type { IdGenerator } from '../../../application/ports/id-generator.ts';
import {
  errorHandler,
  reportToConsole,
  type ReportError,
} from './middleware/error-handler.ts';
import { requestGuard } from './middleware/request-guard.ts';
import { securityHeaders } from './middleware/security-headers.ts';
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
  readonly reportError?: ReportError;
  readonly clock: Clock;
  readonly ids: IdGenerator;
}): OpenAPIHono {
  const app = new OpenAPIHono();

  app.use(securityHeaders());
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
  app.onError(errorHandler(config.reportError ?? reportToConsole));

  return app;
}
