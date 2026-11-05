import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { health } from '@filmfile/contracts/health';
import {
  errorHandler,
  reportToConsole,
  type ReportError,
} from './middleware/error-handler.ts';
import { requestGuard } from './middleware/request-guard.ts';
import { securityHeaders } from './middleware/security-headers.ts';
import type { ArchiveContext } from '../../../domain/shared/archive-context.ts';
import { docsRoutes } from './routes/docs.ts';
import { equipmentRoutes, type EquipmentUseCases } from './routes/equipment.ts';
import { settingsRoutes, type SettingsUseCases } from './routes/settings.ts';
import { eventRoutes, type EventUseCases } from './routes/events.ts';
import { rollRoutes, type RollUseCases } from './routes/rolls.ts';
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
  /** The FilmFile folder's path, which Settings says (D64). */
  readonly folderPath: string;
  readonly ctx: ArchiveContext;
  readonly useCases: RollUseCases &
    EquipmentUseCases &
    EventUseCases &
    SettingsUseCases;
  readonly uiPath?: string;
  readonly port: number;
  readonly uiOrigin?: string;
  readonly reportError?: ReportError;
}): OpenAPIHono {
  const app = new OpenAPIHono();

  app.use(securityHeaders());
  app.use(requestGuard(config));

  app.openapi(getHealth, (c) => c.json({ status: 'ok' } as const, 200));
  app.route('/api/rolls', rollRoutes(config));
  app.route('/api/equipment', equipmentRoutes(config));
  app.route('/api/events', eventRoutes(config));
  app.route('/api/settings', settingsRoutes(config));
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
